-- =============================================================================
-- Pre-order enquiries: a buyer can message a specialist about a gig (or in
-- general) before ordering, then order and pay on Workido from that chat.
--
--  * One enquiry conversation per buyer-specialist pair (service_id is the
--    gig they asked about most recently). Order conversations are unchanged.
--  * Only buyers start enquiries (start_enquiry), at most 20 new ones a day.
--  * Enquiries are text-only; files are shared once an order exists.
--  * Placing an order adds a note to the pair's enquiry pointing to the order.
-- =============================================================================

alter table public.conversations alter column order_id drop not null;
alter table public.conversations
  add column kind text not null default 'order',
  add column buyer_id uuid references public.profiles (id) on delete cascade,
  add column specialist_id uuid references public.profiles (id) on delete cascade,
  add column service_id uuid references public.services (id) on delete set null,
  add constraint conversations_kind check (kind in ('order', 'enquiry')),
  add constraint conversations_kind_shape check (
    (kind = 'order' and order_id is not null)
    or (kind = 'enquiry' and order_id is null and buyer_id is not null and specialist_id is not null and buyer_id <> specialist_id)
  );

create unique index conversations_enquiry_pair_idx on public.conversations (buyer_id, specialist_id) where kind = 'enquiry';
create index conversations_enquiry_specialist_idx on public.conversations (specialist_id) where kind = 'enquiry';

create or replace function public.start_enquiry(p_specialist_id uuid, p_service_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_conversation uuid;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.current_user_is_active() then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;
  if p_specialist_id = v_user then
    raise exception 'You can''t message yourself' using errcode = '23514';
  end if;
  if not public.is_public_specialist(p_specialist_id) then
    raise exception 'This specialist isn''t available to message right now' using errcode = 'P0002';
  end if;
  if p_service_id is not null and not exists (
    select 1 from public.services
    where id = p_service_id and specialist_id = p_specialist_id and publication_status = 'published'
  ) then
    raise exception 'This gig isn''t available' using errcode = 'P0002';
  end if;

  select id into v_conversation from public.conversations
   where kind = 'enquiry' and buyer_id = v_user and specialist_id = p_specialist_id;
  if v_conversation is not null then
    if p_service_id is not null then
      update public.conversations set service_id = p_service_id where id = v_conversation;
    end if;
    return v_conversation;
  end if;

  if (
    select count(*) from public.conversations
    where kind = 'enquiry' and buyer_id = v_user and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'You''ve contacted a lot of specialists today. Please try again tomorrow.' using errcode = '23514';
  end if;

  insert into public.user_roles (user_id, role) values (v_user, 'buyer')
    on conflict (user_id, role) do nothing;
  insert into public.conversations (kind, buyer_id, specialist_id, service_id)
    values ('enquiry', v_user, p_specialist_id, p_service_id)
    on conflict (buyer_id, specialist_id) where kind = 'enquiry' do nothing
    returning id into v_conversation;
  if v_conversation is null then
    -- Created concurrently by another request.
    select id into v_conversation from public.conversations
     where kind = 'enquiry' and buyer_id = v_user and specialist_id = p_specialist_id;
    return v_conversation;
  end if;
  insert into public.conversation_participants (conversation_id, user_id)
    values (v_conversation, v_user), (v_conversation, p_specialist_id);
  return v_conversation;
end;
$$;

revoke execute on function public.start_enquiry(uuid, uuid) from public, anon;
grant execute on function public.start_enquiry(uuid, uuid) to authenticated;

-- Messages: attachments belong to orders (stored under the order's folder).
create or replace function public.messages_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  if public.is_direct_user_request() then
    if new.message_type = 'system' then
      raise exception 'System messages cannot be sent by users' using errcode = '42501';
    end if;
    new.sender_id := auth.uid();
    new.created_at := now();
    if new.attachment_path is not null then
      select order_id into v_order_id from public.conversations where id = new.conversation_id;
      if v_order_id is null then
        raise exception 'Files can be shared once an order is placed' using errcode = '23514';
      end if;
      if new.attachment_path not like (v_order_id::text || '/messages/%') then
        raise exception 'Invalid attachment path' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Notifications name the order or the gig asked about; system notes don't notify.
create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant record;
  v_subject text;
  v_sender_name text;
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  if new.message_type = 'system' then
    return new;
  end if;
  select coalesce(o.title, s.title, 'New enquiry') into v_subject
    from public.conversations c
    left join public.orders o on o.id = c.order_id
    left join public.services s on s.id = c.service_id
   where c.id = new.conversation_id;
  select full_name into v_sender_name from public.profiles where id = new.sender_id;

  for v_participant in
    select user_id from public.conversation_participants
    where conversation_id = new.conversation_id and user_id is distinct from new.sender_id
  loop
    -- One unread message notification per conversation is enough.
    if not exists (
      select 1 from public.notifications
      where user_id = v_participant.user_id and read_at is null
        and type = 'message_received' and related_entity_id = new.conversation_id
    ) then
      perform public.notify_user(v_participant.user_id, 'message_received',
        'New message from ' || coalesce(v_sender_name, 'Workido'), v_subject,
        '/dashboard/messages/' || new.conversation_id::text, 'conversation', new.conversation_id);
    end if;
  end loop;
  return new;
end;
$$;

-- When the pair already talked in an enquiry, point that chat to the order.
create or replace function public.orders_note_in_enquiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.messages (conversation_id, sender_id, message_type, body)
  select c.id, null, 'system',
         'Order ' || new.order_number || ' created for "' || new.title || '". Payment, updates and delivery continue on the order page.'
    from public.conversations c
   where c.kind = 'enquiry' and c.buyer_id = new.buyer_id and c.specialist_id = new.specialist_id;
  return new;
end;
$$;

create trigger orders_note_in_enquiry
  after insert on public.orders
  for each row execute function public.orders_note_in_enquiry();

-- Inbox now includes enquiries. Enquiries without messages are hidden from
-- the specialist (the buyer opened the chat but hasn't written yet).
drop function public.list_my_conversations();
create function public.list_my_conversations()
returns table (
  conversation_id uuid,
  kind text,
  order_id uuid,
  order_title text,
  order_number text,
  order_status public.order_status,
  service_title text,
  counterpart_id uuid,
  counterpart_name text,
  counterpart_username text,
  counterpart_avatar text,
  last_message_at timestamptz,
  last_message_body text,
  last_message_type public.message_type,
  last_sender_id uuid,
  unread_count bigint
)
language sql
stable
set search_path = ''
as $$
  select
    c.id, c.kind, o.id, o.title, o.order_number, o.status, s.title,
    other.id, other.full_name, other.username, other.avatar_path,
    c.last_message_at,
    last_message.body, last_message.message_type, last_message.sender_id,
    (select count(*) from public.messages m
      where m.conversation_id = c.id
        and m.sender_id is distinct from auth.uid()
        and m.message_type <> 'system'
        and (me.last_read_at is null or m.created_at > me.last_read_at))
  from public.conversation_participants me
  join public.conversations c on c.id = me.conversation_id
  left join public.orders o on o.id = c.order_id
  left join public.services s on s.id = c.service_id
  join public.profiles other on other.id = case
      when c.kind = 'order' then case when o.buyer_id = auth.uid() then o.specialist_id else o.buyer_id end
      else case when c.buyer_id = auth.uid() then c.specialist_id else c.buyer_id end
    end
  left join lateral (
    select m.body, m.message_type, m.sender_id from public.messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) last_message on true
  where me.user_id = auth.uid()
    and (c.kind = 'order' or c.last_message_at is not null or c.buyer_id = auth.uid())
  order by coalesce(c.last_message_at, c.created_at) desc
  limit 100;
$$;

revoke execute on function public.list_my_conversations() from public, anon;
grant execute on function public.list_my_conversations() to authenticated;

-- Account deletion also removes the person's enquiries (they aren't part of
-- any order record).
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
  delete from public.conversations where kind = 'enquiry' and (buyer_id = v_user or specialist_id = v_user);
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
