-- =============================================================================
-- Discovery (search + filters + pagination), matching candidates, and
-- administrator operations.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

create index services_title_trgm_idx on public.services using gin (title extensions.gin_trgm_ops);
create index specialist_profiles_headline_trgm_idx on public.specialist_profiles using gin (headline extensions.gin_trgm_ops);
create index profiles_full_name_trgm_idx on public.profiles using gin (full_name extensions.gin_trgm_ops);

-- Escapes LIKE wildcards in user input.
create or replace function public.escape_like(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(coalesce(p_value, ''), '\', '\\'), '%', '\%'), '_', '\_');
$$;

-- ---------------------------------------------------------------------------
-- Gig search. SECURITY INVOKER: row visibility comes from RLS, so only
-- published listings of public specialists are ever returned to the public.
-- ---------------------------------------------------------------------------
create or replace function public.search_services(
  p_category_slug text default null,
  p_query text default null,
  p_min_price_minor bigint default null,
  p_max_price_minor bigint default null,
  p_max_delivery_hours integer default null,
  p_min_rating numeric default null,
  p_availability public.availability_status default null,
  p_skill_slug text default null,
  p_specialist_id uuid default null,
  p_sort text default 'recommended',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  service_id uuid,
  slug text,
  title text,
  price_minor bigint,
  currency text,
  delivery_time_hours integer,
  included_revisions smallint,
  category_name text,
  category_slug text,
  specialist_id uuid,
  specialist_username text,
  specialist_name text,
  specialist_avatar_path text,
  specialist_is_sample boolean,
  availability_status public.availability_status,
  verification_status public.verification_status,
  rating_avg numeric,
  rating_count integer,
  cover_path text,
  published_at timestamptz,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  select
    s.id, s.slug, s.title, s.price_minor, s.currency, s.delivery_time_hours, s.included_revisions,
    c.name, c.slug,
    p.id, p.username, p.full_name, p.avatar_path, p.is_sample,
    sp.availability_status, sp.verification_status, sp.rating_avg, sp.rating_count,
    cover.asset_path,
    s.published_at,
    count(*) over () as total_count
  from public.services s
  join public.categories c on c.id = s.category_id
  left join public.categories parent on parent.id = c.parent_id
  join public.specialist_profiles sp on sp.user_id = s.specialist_id
  join public.profiles p on p.id = s.specialist_id
  left join lateral (
    select pi.asset_path
    from public.portfolio_items pi
    where pi.specialist_id = s.specialist_id
      and pi.visibility = 'public'
      and pi.asset_path is not null
    order by (pi.category_id = s.category_id) desc nulls last, pi.sort_order, pi.created_at
    limit 1
  ) cover on true
  where s.publication_status = 'published'
    and sp.is_published
    and p.account_status = 'active'
    and c.is_active
    and (p_category_slug is null or c.slug = p_category_slug or parent.slug = p_category_slug)
    and (p_query is null or p_query = ''
         or s.title ilike '%' || public.escape_like(p_query) || '%'
         or s.description ilike '%' || public.escape_like(p_query) || '%')
    and (p_min_price_minor is null or s.price_minor >= p_min_price_minor)
    and (p_max_price_minor is null or s.price_minor <= p_max_price_minor)
    and (p_max_delivery_hours is null or s.delivery_time_hours <= p_max_delivery_hours)
    and (p_min_rating is null or sp.rating_avg >= p_min_rating)
    and (p_availability is null or sp.availability_status = p_availability)
    and (p_specialist_id is null or s.specialist_id = p_specialist_id)
    and (p_skill_slug is null or exists (
      select 1 from public.specialist_skills ss
      join public.skills sk on sk.id = ss.skill_id
      where ss.specialist_id = s.specialist_id and sk.slug = p_skill_slug
    ))
  order by
    case when p_sort = 'price_asc' then s.price_minor end asc,
    case when p_sort = 'price_desc' then s.price_minor end desc,
    case when p_sort = 'delivery' then s.delivery_time_hours end asc,
    case when p_sort = 'rating' then sp.rating_avg end desc nulls last,
    case when p_sort = 'newest' then s.published_at end desc,
    -- "recommended": available specialists first, then verified, then
    -- real completed-order history, then recency.
    case sp.availability_status when 'available' then 0 when 'busy' then 1 else 2 end,
    (sp.verification_status = 'verified') desc,
    sp.completed_orders_count desc,
    s.published_at desc nulls last,
    s.id
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ---------------------------------------------------------------------------
-- Specialist search
-- ---------------------------------------------------------------------------
create or replace function public.search_specialists(
  p_query text default null,
  p_skill_slug text default null,
  p_category_slug text default null,
  p_availability public.availability_status default null,
  p_max_starting_price_minor bigint default null,
  p_experience public.experience_level default null,
  p_min_rating numeric default null,
  p_sort text default 'recommended',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  specialist_id uuid,
  username text,
  full_name text,
  avatar_path text,
  is_sample boolean,
  headline text,
  experience_level public.experience_level,
  availability_status public.availability_status,
  verification_status public.verification_status,
  rating_avg numeric,
  rating_count integer,
  completed_orders_count integer,
  starting_price_minor bigint,
  currency text,
  skills text[],
  city text,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with base as (
    select
      sp.user_id, p.username, p.full_name, p.avatar_path, p.is_sample,
      sp.headline, sp.experience_level, sp.availability_status, sp.verification_status,
      sp.rating_avg, sp.rating_count, sp.completed_orders_count, p.city, sp.published_at,
      (select min(s.price_minor) from public.services s
        where s.specialist_id = sp.user_id and s.publication_status = 'published') as starting_price,
      (select min(s.currency) from public.services s
        where s.specialist_id = sp.user_id and s.publication_status = 'published') as currency,
      array(
        select sk.name from public.specialist_skills ss join public.skills sk on sk.id = ss.skill_id
        where ss.specialist_id = sp.user_id order by sk.name limit 6
      ) as skill_names
    from public.specialist_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.is_published
      and p.account_status = 'active'
      and (p_query is null or p_query = ''
           or p.full_name ilike '%' || public.escape_like(p_query) || '%'
           or sp.headline ilike '%' || public.escape_like(p_query) || '%'
           or p.username ilike '%' || public.escape_like(p_query) || '%')
      and (p_availability is null or sp.availability_status = p_availability)
      and (p_experience is null or sp.experience_level = p_experience)
      and (p_min_rating is null or sp.rating_avg >= p_min_rating)
      and (p_skill_slug is null or exists (
        select 1 from public.specialist_skills ss join public.skills sk on sk.id = ss.skill_id
        where ss.specialist_id = sp.user_id and sk.slug = p_skill_slug
      ))
      and (p_category_slug is null or exists (
        select 1 from public.categories c
        left join public.categories parent on parent.id = c.parent_id
        where (c.slug = p_category_slug or parent.slug = p_category_slug)
          and (
            exists (select 1 from public.specialist_categories sc where sc.specialist_id = sp.user_id and sc.category_id = c.id)
            or exists (select 1 from public.services s where s.specialist_id = sp.user_id and s.category_id = c.id and s.publication_status = 'published')
          )
      ))
  )
  select
    b.user_id, b.username, b.full_name, b.avatar_path, b.is_sample, b.headline, b.experience_level,
    b.availability_status, b.verification_status, b.rating_avg, b.rating_count, b.completed_orders_count,
    b.starting_price, b.currency, b.skill_names, b.city,
    count(*) over () as total_count
  from base b
  where p_max_starting_price_minor is null or b.starting_price <= p_max_starting_price_minor
  order by
    case when p_sort = 'price_asc' then b.starting_price end asc nulls last,
    case when p_sort = 'rating' then b.rating_avg end desc nulls last,
    case when p_sort = 'newest' then b.published_at end desc,
    case b.availability_status when 'available' then 0 when 'busy' then 1 else 2 end,
    (b.verification_status = 'verified') desc,
    b.completed_orders_count desc,
    b.published_at desc nulls last,
    b.user_id
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ---------------------------------------------------------------------------
-- Matching candidates for a requirement. Returns only public specialist data
-- plus aggregate reliability metrics; the scoring itself happens in the
-- deterministic engine (src/lib/domain/matching). Only the requirement owner
-- (or an admin) may call it.
-- ---------------------------------------------------------------------------
create or replace function public.get_match_candidates(p_requirement_id uuid)
returns table (
  specialist_id uuid,
  username text,
  full_name text,
  avatar_path text,
  is_sample boolean,
  headline text,
  is_published boolean,
  account_status public.account_status,
  experience_level public.experience_level,
  availability_status public.availability_status,
  verification_status public.verification_status,
  skill_ids uuid[],
  category_ids uuid[],
  service_category_ids uuid[],
  min_price_in_category_minor bigint,
  min_price_any_minor bigint,
  min_delivery_in_category_hours integer,
  min_delivery_any_hours integer,
  portfolio_in_category integer,
  portfolio_total integer,
  completed_orders integer,
  rating_avg numeric,
  rating_count integer,
  on_time_rate numeric,
  on_time_sample integer,
  cancellation_rate numeric,
  cancellation_sample integer,
  city text,
  region text,
  country_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_req public.requirements;
  v_category_ids uuid[];
begin
  select * into v_req from public.requirements where id = p_requirement_id;
  if not found or (v_req.buyer_id <> auth.uid() and not public.is_admin()) then
    raise exception 'Requirement not found' using errcode = 'P0002';
  end if;

  -- The requirement's category, its subcategory, and children of the category.
  select array_agg(distinct c.id) into v_category_ids
    from public.categories c
   where c.id in (v_req.category_id, v_req.subcategory_id) or c.parent_id = v_req.category_id;
  v_category_ids := coalesce(v_category_ids, '{}');

  return query
  with candidates as (
    select sp.user_id
    from public.specialist_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.is_published
      and p.account_status = 'active'
      and sp.user_id <> v_req.buyer_id
      and (
        exists (select 1 from public.specialist_categories sc
                where sc.specialist_id = sp.user_id and sc.category_id = any (v_category_ids))
        or exists (select 1 from public.services s
                   where s.specialist_id = sp.user_id and s.publication_status = 'published'
                     and s.category_id = any (v_category_ids))
        or exists (select 1 from public.specialist_skills ss
                   join public.requirement_skills rs on rs.skill_id = ss.skill_id
                   where ss.specialist_id = sp.user_id and rs.requirement_id = v_req.id)
      )
    limit 300
  )
  select
    sp.user_id, p.username, p.full_name, p.avatar_path, p.is_sample, sp.headline,
    sp.is_published, p.account_status, sp.experience_level, sp.availability_status, sp.verification_status,
    array(select ss.skill_id from public.specialist_skills ss where ss.specialist_id = sp.user_id),
    array(
      select sc.category_id from public.specialist_categories sc where sc.specialist_id = sp.user_id
      union
      select sk.category_id from public.specialist_skills ss join public.skills sk on sk.id = ss.skill_id
       where ss.specialist_id = sp.user_id and sk.category_id is not null
    ),
    array(select distinct s.category_id from public.services s
           where s.specialist_id = sp.user_id and s.publication_status = 'published'),
    (select min(s.price_minor) from public.services s
      where s.specialist_id = sp.user_id and s.publication_status = 'published'
        and s.category_id = any (v_category_ids) and s.currency = v_req.currency),
    (select min(s.price_minor) from public.services s
      where s.specialist_id = sp.user_id and s.publication_status = 'published' and s.currency = v_req.currency),
    (select min(s.delivery_time_hours) from public.services s
      where s.specialist_id = sp.user_id and s.publication_status = 'published'
        and s.category_id = any (v_category_ids)),
    (select min(s.delivery_time_hours) from public.services s
      where s.specialist_id = sp.user_id and s.publication_status = 'published'),
    (select count(*)::integer from public.portfolio_items pi
      where pi.specialist_id = sp.user_id and pi.visibility = 'public' and pi.category_id = any (v_category_ids)),
    (select count(*)::integer from public.portfolio_items pi
      where pi.specialist_id = sp.user_id and pi.visibility = 'public'),
    rep.completed_orders, rep.rating_avg, rep.rating_count,
    rep.on_time_rate, rep.on_time_sample, rep.cancellation_rate, rep.cancellation_sample,
    p.city, p.region, p.country_code
  from candidates cand
  join public.specialist_profiles sp on sp.user_id = cand.user_id
  join public.profiles p on p.id = sp.user_id
  cross join lateral public.get_specialist_reputation(sp.user_id) rep;
end;
$$;

-- ---------------------------------------------------------------------------
-- Administrator operations. Every function checks is_admin() itself and
-- writes to the admin_actions audit log.
-- ---------------------------------------------------------------------------
create or replace function public.admin_platform_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'buyers', (select count(*) from public.user_roles where role = 'buyer'),
    'specialists', (select count(*) from public.user_roles where role = 'specialist'),
    'published_specialists', (select count(*) from public.specialist_profiles where is_published),
    'suspended_users', (select count(*) from public.profiles where account_status = 'suspended'),
    'open_requirements', (select count(*) from public.requirements where status = 'open'),
    'published_services', (select count(*) from public.services where publication_status = 'published'),
    'active_orders', (select count(*) from public.orders where status in ('paid', 'in_progress', 'submitted', 'revision_requested')),
    'awaiting_payment_orders', (select count(*) from public.orders where status = 'pending_payment'),
    'completed_orders', (select count(*) from public.orders where status = 'completed'),
    'disputed_orders', (select count(*) from public.orders where status = 'disputed'),
    'pending_refunds', (select count(*) from public.refunds where status in ('pending', 'processing', 'failed')),
    'pending_payouts', (select count(*) from public.orders where payout_status = 'pending'),
    'pending_verifications', (select count(*) from public.verification_requests where status = 'pending'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    -- GTV: value of orders whose payment was verified, excluding orders
    -- that were refunded or are being refunded. Not platform revenue.
    'gtv_by_currency', coalesce((
      select jsonb_object_agg(currency, total) from (
        select currency, sum(total_minor) as total from public.orders
        where paid_at is not null and status not in ('refund_pending', 'refunded')
        group by currency
      ) g), '{}'::jsonb),
    -- Platform revenue: fees on completed orders only.
    'platform_revenue_by_currency', coalesce((
      select jsonb_object_agg(currency, total) from (
        select currency, sum(buyer_fee_minor + specialist_fee_minor) as total from public.orders
        where status = 'completed'
        group by currency
      ) r), '{}'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.admin_search_users(
  p_query text default null,
  p_role public.app_role default null,
  p_status public.account_status default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  full_name text,
  email text,
  account_status public.account_status,
  roles public.app_role[],
  is_sample boolean,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
  select p.id, p.username, p.full_name, u.email::text, p.account_status,
         array(select ur.role from public.user_roles ur where ur.user_id = p.id order by ur.role),
         p.is_sample, p.created_at, count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  where (p_query is null or p_query = ''
         or p.full_name ilike '%' || public.escape_like(p_query) || '%'
         or p.username ilike '%' || public.escape_like(p_query) || '%'
         or u.email ilike '%' || public.escape_like(p_query) || '%')
    and (p_role is null or exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = p_role))
    and (p_status is null or p.account_status = p_status)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

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

create or replace function public.admin_review_verification(p_request_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.verification_requests;
  v_status public.verification_status := case when p_approve then 'verified'::public.verification_status else 'rejected'::public.verification_status end;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  select * into v_request from public.verification_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Pending verification request not found' using errcode = 'P0002';
  end if;
  if v_request.specialist_id = auth.uid() then
    raise exception 'You cannot review your own verification' using errcode = '42501';
  end if;
  if not p_approve and coalesce(char_length(trim(p_note)), 0) < 10 then
    raise exception 'Explain why the verification was rejected (at least 10 characters)' using errcode = '23514';
  end if;

  update public.verification_requests set
    status = v_status, decision_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = v_request.id;
  update public.specialist_profiles set verification_status = v_status where user_id = v_request.specialist_id;

  perform public.notify_user(v_request.specialist_id,
    case when p_approve then 'verification_approved' else 'verification_rejected' end,
    case when p_approve then 'Your profile is verified' else 'Verification not approved' end,
    case when p_approve then 'Your verified badge is now visible on your profile.'
         else left(trim(p_note), 500) end,
    '/dashboard/specialist/profile', 'verification', v_request.id);

  insert into public.admin_actions (admin_id, action, target_type, target_id, reason)
    values (auth.uid(), case when p_approve then 'approve_verification' else 'reject_verification' end,
            'user', v_request.specialist_id, nullif(trim(p_note), ''));
end;
$$;

create or replace function public.admin_moderate_service(p_service_id uuid, p_remove boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if coalesce(char_length(trim(p_reason)), 0) < 5 then
    raise exception 'Record a reason (at least 5 characters)' using errcode = '23514';
  end if;
  select * into v_service from public.services where id = p_service_id for update;
  if not found then
    raise exception 'Service not found' using errcode = 'P0002';
  end if;

  update public.services set
    publication_status = case when p_remove then 'removed'::public.publication_status else 'unpublished'::public.publication_status end,
    moderation_note = left(trim(p_reason), 500)
  where id = v_service.id;

  perform public.notify_user(v_service.specialist_id,
    case when p_remove then 'service_removed' else 'service_restored' end,
    case when p_remove then 'A listing was removed by moderation' else 'A listing was restored' end,
    v_service.title || ': ' || left(trim(p_reason), 300),
    '/dashboard/specialist/services', 'service', v_service.id);

  insert into public.admin_actions (admin_id, action, target_type, target_id, reason)
    values (auth.uid(), case when p_remove then 'remove_service' else 'restore_service' end,
            'service', v_service.id, trim(p_reason));
end;
$$;

create or replace function public.admin_review_report(p_report_id uuid, p_status public.report_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_status = 'open' then
    raise exception 'Choose reviewed or dismissed' using errcode = '23514';
  end if;
  update public.reports set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_report_id;
  insert into public.admin_actions (admin_id, action, target_type, target_id)
    values (auth.uid(), 'review_report_' || p_status::text, 'report', p_report_id);
end;
$$;
