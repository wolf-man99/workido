-- ============================================================================
-- Workido: remove the temporary sample data
-- ============================================================================
--
-- Deletes every sample account (profiles flagged is_sample, or emails on
-- sample.workido.test) and everything attached to them: services, portfolio,
-- requirements, offers, orders (including orders a real account placed with a
-- sample specialist while testing), payments, refunds, messages, reviews and
-- notifications. Real accounts are kept; reputation figures of any real
-- specialist who worked with sample buyers are recalculated.
--
-- Files uploaded while testing are not deleted (Supabase only allows that
-- through Storage); the script reports which folders to delete there.
--
-- Paste into Supabase -> SQL Editor and click Run. Safe to run more than once.
-- ============================================================================

do $remove$
declare
  v_users uuid[];
  v_orders uuid[];
  v_requirements uuid[];
  v_affected_specialists uuid[];
  v_specialist uuid;
  v_files integer := 0;
begin
  select coalesce(array_agg(id), '{}') into v_users from (
    select id from public.profiles where is_sample
    union
    select id from auth.users where email like '%@sample.workido.test'
  ) sample;

  if cardinality(v_users) = 0 then
    raise notice 'No sample data found. Nothing to remove.';
    return;
  end if;

  select coalesce(array_agg(id), '{}') into v_orders
    from public.orders where buyer_id = any(v_users) or specialist_id = any(v_users);
  select coalesce(array_agg(id), '{}') into v_requirements
    from public.requirements where buyer_id = any(v_users);
  select coalesce(array_agg(distinct specialist_id), '{}') into v_affected_specialists
    from public.orders where id = any(v_orders) and not specialist_id = any(v_users);

  -- Payment records and orders are protected from accidental deletion
  -- (on delete restrict), so remove them explicitly, children first.
  delete from public.refunds where order_id = any(v_orders);
  delete from public.payments where order_id = any(v_orders);
  delete from public.notifications where related_entity_id = any(v_orders || v_requirements);
  delete from public.orders where id = any(v_orders);
  delete from public.requirements where id = any(v_requirements);
  delete from public.services where specialist_id = any(v_users);

  -- Deleting the auth users cascades to profiles, roles, settings, specialist
  -- profiles, portfolio, invitations, offers, saved specialists and notifications.
  delete from auth.users where id = any(v_users);

  foreach v_specialist in array v_affected_specialists loop
    perform public.refresh_specialist_rating(v_specialist);
    perform public.refresh_specialist_completed_orders(v_specialist);
  end loop;

  -- Files uploaded while testing can't be deleted from SQL (Supabase only
  -- allows that through the Storage API), so report where they are.
  select count(*) into v_files from storage.objects
    where (bucket_id in ('avatars', 'portfolio') and (storage.foldername(name))[1] = any(v_users::text[]))
       or (bucket_id = 'requirement-files' and (storage.foldername(name))[1] = any(v_requirements::text[]))
       or (bucket_id = 'order-files' and (storage.foldername(name))[1] = any(v_orders::text[]));
  if v_files > 0 then
    raise notice '% uploaded test file(s) remain. Delete them in Supabase -> Storage: in avatars/portfolio the folders named %, in requirement-files %, in order-files %.',
      v_files, v_users, v_requirements, v_orders;
  end if;

  raise notice 'Removed % sample accounts, % orders and % requirements.',
    cardinality(v_users), cardinality(v_orders), cardinality(v_requirements);
end
$remove$;
