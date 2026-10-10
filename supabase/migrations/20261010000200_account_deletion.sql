-- =============================================================================
-- Self-service account deletion (buyers and specialists).
--
--  * No order history: the auth user is deleted and everything attached to it
--    goes with it (profile, roles, services, portfolio, requirements, offers).
--  * With order history: orders, payments, messages and reviews stay because
--    the other party (and accounting) still needs them. The account is
--    anonymised instead: personal data removed, shown as "Deleted user",
--    login removed and the email freed so the person can sign up again.
--  * Blocked while work or money is in flight (orders in progress, disputes)
--    or a payout is still owed to the specialist.
-- =============================================================================

-- Deleted accounts appear as "Deleted user" on the other party's orders,
-- messages and reviews, so their (anonymised) profile stays readable.
drop policy "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles
  for select using (account_status in ('active', 'deleted') or id = auth.uid() or public.is_admin());

-- Why the signed-in user can't delete their account right now (null = they can).
create or replace function public.account_deletion_blocker()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_status public.account_status;
begin
  if v_user is null then
    return 'Please log in again to delete your account.';
  end if;
  select account_status into v_status from public.profiles where id = v_user;
  if v_status is null or v_status = 'deleted' then
    return 'This account has already been deleted.';
  end if;
  if v_status = 'suspended' then
    return 'This account is suspended. Contact support to close it.';
  end if;
  if public.is_admin() then
    return 'Administrator accounts can''t be deleted here. Ask another administrator to remove your admin access first.';
  end if;
  if exists (
    select 1 from public.orders
    where (buyer_id = v_user or specialist_id = v_user)
      and status in ('paid', 'in_progress', 'submitted', 'revision_requested', 'disputed')
  ) then
    return 'You have orders in progress. Complete, cancel or resolve them before deleting your account.';
  end if;
  if exists (select 1 from public.orders where specialist_id = v_user and payout_status in ('pending', 'on_hold')) then
    return 'A payout for one of your completed orders is still being settled. You can delete your account once it has been paid out.';
  end if;
  return null;
end;
$$;

create or replace function public.delete_my_account(p_confirmation text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_blocker text;
  v_order record;
begin
  if coalesce(trim(p_confirmation), '') <> 'Delete my Workido account' then
    raise exception 'Type "Delete my Workido account" exactly to confirm.' using errcode = '22023';
  end if;
  v_blocker := public.account_deletion_blocker();
  if v_blocker is not null then
    raise exception '%', v_blocker using errcode = '23514';
  end if;

  -- Unpaid orders can't go ahead without this account: cancel them so the
  -- other party is notified (nothing was paid).
  for v_order in
    select id, buyer_id from public.orders
    where (buyer_id = v_user or specialist_id = v_user) and status = 'pending_payment'
  loop
    perform public.apply_order_transition(
      v_order.id,
      case when v_order.buyer_id = v_user then 'buyer' else 'specialist' end,
      'cancel', v_user, jsonb_build_object('note', 'The account was deleted.'));
  end loop;

  if not exists (select 1 from public.orders where buyer_id = v_user or specialist_id = v_user) then
    -- No order history: remove everything (cascades from the auth user).
    delete from auth.users where id = v_user;
    return 'deleted';
  end if;

  -- Order history exists: keep what the other party needs, remove the rest.
  delete from public.requirements r
    where r.buyer_id = v_user and not exists (select 1 from public.orders o where o.requirement_id = r.id);
  delete from public.offers f
    where f.specialist_id = v_user and not exists (select 1 from public.orders o where o.offer_id = f.id);
  delete from public.requirement_invitations where specialist_id = v_user;
  delete from public.requirement_matches where specialist_id = v_user;
  delete from public.services s
    where s.specialist_id = v_user and not exists (select 1 from public.orders o where o.service_id = s.id);
  update public.services set publication_status = 'unpublished'
    where specialist_id = v_user and publication_status = 'published';
  delete from public.portfolio_items where specialist_id = v_user;
  delete from public.specialist_skills where specialist_id = v_user;
  delete from public.specialist_categories where specialist_id = v_user;
  delete from public.verification_requests where specialist_id = v_user;
  update public.specialist_profiles set
    is_published = false, headline = null, professional_bio = null, years_experience = null,
    availability_status = 'unavailable', verification_status = 'not_submitted'
  where user_id = v_user;
  delete from public.saved_specialists where buyer_id = v_user or specialist_id = v_user;
  delete from public.notifications where user_id = v_user;
  delete from public.user_roles where user_id = v_user;
  update public.user_settings set
    phone = null, whatsapp_opt_in = false, email_notifications = false, marketing_emails = false
  where user_id = v_user;
  update public.profiles set
    full_name = 'Deleted user',
    username = 'deleted-' || substr(replace(v_user::text, '-', ''), 1, 12),
    avatar_path = null, bio = null, city = null, region = null, country_code = null, website_url = null,
    account_status = 'deleted'
  where id = v_user;

  -- Remove the login: no email, password or identities left; the email
  -- address can be used for a new account.
  update auth.users set
    email = 'deleted-' || v_user::text || '@deleted.workido.invalid',
    encrypted_password = '',
    phone = null,
    raw_user_meta_data = '{}'::jsonb,
    banned_until = 'infinity',
    deleted_at = now(),
    updated_at = now()
  where id = v_user;
  delete from auth.identities where user_id = v_user;
  delete from auth.sessions where user_id = v_user;
  delete from auth.refresh_tokens where user_id = v_user::text;
  delete from auth.mfa_factors where user_id = v_user;

  return 'anonymised';
end;
$$;

revoke execute on function public.account_deletion_blocker() from public, anon;
revoke execute on function public.delete_my_account(text) from public, anon;
grant execute on function public.account_deletion_blocker() to authenticated;
grant execute on function public.delete_my_account(text) to authenticated;

-- Admins can suspend and reactivate, but a deleted account stays deleted.
create or replace function public.admin_set_account_status(p_user_id uuid, p_status public.account_status, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own account status' using errcode = '23514';
  end if;
  if p_status = 'deleted' or exists (select 1 from public.profiles where id = p_user_id and account_status = 'deleted') then
    raise exception 'Deleted accounts can''t be suspended or reactivated' using errcode = '23514';
  end if;
  if coalesce(char_length(trim(p_reason)), 0) < 5 then
    raise exception 'Record a reason (at least 5 characters)' using errcode = '23514';
  end if;
  update public.profiles set account_status = p_status where id = p_user_id;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, reason)
    values (auth.uid(), case p_status when 'suspended' then 'suspend_user' else 'reactivate_user' end,
            'user', p_user_id, trim(p_reason));
end;
$$;
