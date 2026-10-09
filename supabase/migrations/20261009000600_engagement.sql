-- =============================================================================
-- Messaging, reviews & reputation, notifications, saved specialists,
-- abuse reports and product analytics events.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Order-scoped messaging
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  message_type public.message_type not null default 'text',
  body text constraint messages_body_length check (char_length(body) <= 4000),
  attachment_path text,
  attachment_name text constraint messages_attachment_name check (char_length(attachment_name) <= 255),
  attachment_type text,
  attachment_size bigint constraint messages_attachment_size check (attachment_size > 0),
  created_at timestamptz not null default now(),
  constraint messages_has_content check (
    (message_type = 'file' and attachment_path is not null)
    or (message_type in ('text', 'system') and char_length(trim(body)) > 0)
  )
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  );
$$;

-- Every order gets exactly one conversation between its two parties.
create or replace function public.orders_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation uuid;
begin
  insert into public.conversations (order_id) values (new.id) returning id into v_conversation;
  insert into public.conversation_participants (conversation_id, user_id)
    values (v_conversation, new.buyer_id), (v_conversation, new.specialist_id);
  return new;
end;
$$;

create trigger orders_after_insert
  after insert on public.orders
  for each row execute function public.orders_after_insert();

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
      if new.attachment_path not like (v_order_id::text || '/messages/%') then
        raise exception 'Invalid attachment path' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversation_participants
     set last_read_at = now()
   where conversation_id = p_conversation_id and user_id = auth.uid();
  update public.notifications
     set read_at = now()
   where user_id = auth.uid() and read_at is null
     and related_entity_type = 'conversation' and related_entity_id = p_conversation_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Abuse reports
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null constraint reports_reason check (reason in ('spam', 'harassment', 'fraud', 'off_platform_payment', 'inappropriate', 'other')),
  details text constraint reports_details check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Reviews (transaction-based only)
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null constraint reviews_rating_range check (rating between 1 and 5),
  comment text constraint reviews_comment_length check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  constraint reviews_one_per_reviewer unique (order_id, reviewer_id),
  constraint reviews_not_self check (reviewer_id <> reviewee_id)
);

create index reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);

-- Only the two parties of a COMPLETED order may review each other.
create or replace function public.can_review_order(p_order_id uuid, p_reviewee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and o.status = 'completed'
      and (
        (o.buyer_id = auth.uid() and o.specialist_id = p_reviewee_id)
        or (o.specialist_id = auth.uid() and o.buyer_id = p_reviewee_id)
      )
  );
$$;

-- Keeps the cached public rating on specialist_profiles in sync. Only
-- reviews written by the buyer about the specialist of the order count.
create or replace function public.refresh_specialist_rating(p_specialist_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.specialist_profiles sp set
    rating_count = agg.cnt,
    rating_avg = agg.avg_rating
  from (
    select count(*)::integer as cnt, round(avg(r.rating)::numeric, 2) as avg_rating
    from public.reviews r
    join public.orders o on o.id = r.order_id
    where r.reviewee_id = p_specialist_id
      and o.specialist_id = p_specialist_id
      and r.reviewer_id = o.buyer_id
  ) agg
  where sp.user_id = p_specialist_id;
end;
$$;

create or replace function public.refresh_specialist_completed_orders(p_specialist_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.specialist_profiles set completed_orders_count = (
    select count(*) from public.orders where specialist_id = p_specialist_id and status = 'completed'
  ) where user_id = p_specialist_id;
end;
$$;

revoke execute on function public.refresh_specialist_rating(uuid) from public, anon, authenticated;
revoke execute on function public.refresh_specialist_completed_orders(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Saved specialists
-- ---------------------------------------------------------------------------
create table public.saved_specialists (
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  specialist_id uuid not null references public.specialist_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (buyer_id, specialist_id),
  constraint saved_specialists_not_self check (buyer_id <> specialist_id)
);

-- ---------------------------------------------------------------------------
-- In-app notifications (outbox for email delivery as well)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null constraint notifications_type check (type ~ '^[a-z_]{3,60}$'),
  title text not null constraint notifications_title check (char_length(title) <= 200),
  body text constraint notifications_body check (char_length(body) <= 1000),
  link_path text constraint notifications_link check (link_path ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  related_entity_type text,
  related_entity_id uuid,
  read_at timestamptz,
  -- Set by the email dispatcher once delivered (or skipped by preference).
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);
create index notifications_email_outbox_idx on public.notifications (created_at) where emailed_at is null;

-- Internal helper used by triggers and definer functions.
create or replace function public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link_path text,
  p_entity_type text default null,
  p_entity_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, link_path, related_entity_type, related_entity_id)
  values (p_user_id, p_type, left(p_title, 200), left(p_body, 1000), p_link_path, p_entity_type, p_entity_id);
end;
$$;

revoke execute on function public.notify_user(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;

create or replace function public.mark_notifications_read(p_notification_ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null
     and (p_notification_ids is null or id = any (p_notification_ids));
end;
$$;

-- ---------------------------------------------------------------------------
-- Notification triggers
-- ---------------------------------------------------------------------------
create or replace function public.orders_after_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link text := '/dashboard/orders/' || new.id::text;
  v_title text := new.title;
begin
  if new.status = old.status then
    return new;
  end if;

  case new.status
    when 'paid' then
      perform public.notify_user(new.specialist_id, 'order_paid', 'New paid order: ' || v_title,
        'Payment is verified. Accept the order to start work.', v_link, 'order', new.id);
      perform public.notify_user(new.buyer_id, 'payment_verified', 'Payment confirmed',
        'Your payment for "' || v_title || '" is verified. The specialist has been notified.', v_link, 'order', new.id);
    when 'in_progress' then
      if old.status = 'paid' then
        perform public.notify_user(new.buyer_id, 'order_accepted', 'Work has started',
          'Your specialist accepted "' || v_title || '".', v_link, 'order', new.id);
      else
        perform public.notify_user(new.buyer_id, 'order_resumed', 'Work has resumed', v_title, v_link, 'order', new.id);
        perform public.notify_user(new.specialist_id, 'order_resumed', 'Work has resumed', v_title, v_link, 'order', new.id);
      end if;
    when 'submitted' then
      perform public.notify_user(new.buyer_id, 'work_submitted', 'Deliverables ready for review',
        'Review the work for "' || v_title || '" and approve it or request a revision.', v_link, 'order', new.id);
    when 'revision_requested' then
      perform public.notify_user(new.specialist_id, 'revision_requested', 'Revision requested',
        'The buyer requested changes on "' || v_title || '".', v_link, 'order', new.id);
    when 'completed' then
      perform public.notify_user(new.specialist_id, 'order_completed', 'Order completed',
        '"' || v_title || '" was approved and completed.', v_link, 'order', new.id);
      perform public.notify_user(new.buyer_id, 'order_completed', 'Order completed',
        'Leave a review to help other buyers.', v_link, 'order', new.id);
      perform public.refresh_specialist_completed_orders(new.specialist_id);
    when 'cancelled' then
      perform public.notify_user(new.buyer_id, 'order_cancelled', 'Order cancelled', v_title, v_link, 'order', new.id);
      perform public.notify_user(new.specialist_id, 'order_cancelled', 'Order cancelled', v_title, v_link, 'order', new.id);
    when 'refund_pending' then
      perform public.notify_user(new.buyer_id, 'refund_pending', 'Refund initiated',
        'A refund for "' || v_title || '" is being processed.', v_link, 'order', new.id);
      perform public.notify_user(new.specialist_id, 'order_cancelled', 'Order closed with refund', v_title, v_link, 'order', new.id);
    when 'refunded' then
      perform public.notify_user(new.buyer_id, 'refund_processed', 'Refund processed',
        'The payment provider confirmed your refund for "' || v_title || '".', v_link, 'order', new.id);
    when 'disputed' then
      perform public.notify_user(new.buyer_id, 'dispute_opened', 'Dispute opened', v_title, v_link, 'order', new.id);
      perform public.notify_user(new.specialist_id, 'dispute_opened', 'Dispute opened', v_title, v_link, 'order', new.id);
    else
      null;
  end case;

  -- A completed order leaving "completed" is impossible, but keep counts honest.
  if old.status = 'completed' then
    perform public.refresh_specialist_completed_orders(new.specialist_id);
  end if;
  return new;
end;
$$;

create trigger orders_after_status_change
  after update of status on public.orders
  for each row execute function public.orders_after_status_change();

create or replace function public.invitations_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  select title into v_title from public.requirements where id = new.requirement_id;
  perform public.notify_user(new.specialist_id, 'invitation_received', 'You were invited to a task',
    v_title, '/dashboard/specialist/opportunities/' || new.requirement_id::text, 'requirement', new.requirement_id);
  return new;
end;
$$;

create trigger invitations_after_insert
  after insert on public.requirement_invitations
  for each row execute function public.invitations_after_insert();

create or replace function public.offers_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.requirements;
begin
  select * into v_req from public.requirements where id = new.requirement_id;
  if tg_op = 'INSERT' then
    perform public.notify_user(v_req.buyer_id, 'offer_received', 'New offer on your task', v_req.title,
      '/dashboard/buyer/requirements/' || v_req.id::text, 'requirement', v_req.id);
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then
      perform public.notify_user(new.specialist_id, 'offer_accepted', 'Your offer was accepted',
        v_req.title || ' — the order is awaiting payment.', '/dashboard/specialist/orders', 'requirement', v_req.id);
    elsif new.status = 'declined' then
      perform public.notify_user(new.specialist_id, 'offer_declined', 'Offer not selected', v_req.title,
        '/dashboard/specialist/opportunities/' || v_req.id::text, 'requirement', v_req.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger offers_notify
  after insert or update of status on public.offers
  for each row execute function public.offers_notify();

create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant record;
  v_order public.orders;
  v_sender_name text;
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  select o.* into v_order from public.orders o join public.conversations c on c.order_id = o.id where c.id = new.conversation_id;
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
        'New message from ' || coalesce(v_sender_name, 'Workido'), v_order.title,
        '/dashboard/messages/' || new.conversation_id::text, 'conversation', new.conversation_id);
    end if;
  end loop;
  return new;
end;
$$;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.messages_after_insert();

create or replace function public.reviews_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_specialist_rating(new.reviewee_id);
  perform public.notify_user(new.reviewee_id, 'review_received', 'You received a ' || new.rating || '-star review',
    left(coalesce(new.comment, ''), 200), '/dashboard/orders/' || new.order_id::text, 'order', new.order_id);
  return new;
end;
$$;

create trigger reviews_after_insert
  after insert on public.reviews
  for each row execute function public.reviews_after_insert();

-- ---------------------------------------------------------------------------
-- Product analytics (internal event log, no sensitive payloads)
-- ---------------------------------------------------------------------------
create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null constraint analytics_event_name check (event_name ~ '^[a-z_]{3,60}$'),
  user_id uuid references public.profiles (id) on delete set null,
  properties jsonb not null default '{}'::jsonb
    constraint analytics_properties_size check (pg_column_size(properties) <= 4096),
  created_at timestamptz not null default now()
);

create index analytics_events_name_idx on public.analytics_events (event_name, created_at desc);

-- ---------------------------------------------------------------------------
-- Reputation (derived from real data; never seeded)
-- ---------------------------------------------------------------------------
create or replace function public.get_specialist_reputation(p_specialist_id uuid)
returns table (
  completed_orders integer,
  rating_avg numeric,
  rating_count integer,
  on_time_rate numeric,
  on_time_sample integer,
  repeat_clients integer,
  cancellation_rate numeric,
  cancellation_sample integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with o as (
    select * from public.orders where specialist_id = p_specialist_id
  ),
  delivered as (
    select * from o where status = 'completed' and delivery_deadline is not null and first_submitted_at is not null
  ),
  engaged as (
    -- Orders where money moved, i.e. the specialist was actually engaged.
    select * from o where paid_at is not null
  ),
  ratings as (
    select r.rating from public.reviews r
    join o on o.id = r.order_id
    where r.reviewee_id = p_specialist_id and r.reviewer_id = o.buyer_id
  )
  select
    (select count(*)::integer from o where status = 'completed'),
    (select round(avg(rating)::numeric, 2) from ratings),
    (select count(*)::integer from ratings),
    (select case when count(*) = 0 then null
            else round(count(*) filter (where first_submitted_at <= delivery_deadline)::numeric / count(*), 4) end
       from delivered),
    (select count(*)::integer from delivered),
    (select count(*)::integer from (
       select buyer_id from o where status = 'completed' group by buyer_id having count(*) >= 2
     ) repeaters),
    (select case when count(*) = 0 then null
            else round(count(*) filter (where status in ('refund_pending', 'refunded', 'cancelled'))::numeric / count(*), 4) end
       from engaged),
    (select count(*)::integer from engaged);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.reviews enable row level security;
alter table public.saved_specialists enable row level security;
alter table public.notifications enable row level security;
alter table public.analytics_events enable row level security;

create policy "conversations_select" on public.conversations
  for select to authenticated
  using (public.is_conversation_participant(id) or public.is_admin());

create policy "conversation_participants_select" on public.conversation_participants
  for select to authenticated
  using (public.is_conversation_participant(conversation_id) or public.is_admin());

-- Only participants can read messages. Admins investigate via reports and
-- disputes, which link to the relevant order.
create policy "messages_select" on public.messages
  for select to authenticated
  using (public.is_conversation_participant(conversation_id) or public.is_admin());
create policy "messages_insert" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and public.current_user_is_active()
  );

create policy "reports_insert" on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open');
create policy "reports_select" on public.reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_admin());

create policy "reviews_select" on public.reviews for select using (true);
create policy "reviews_insert" on public.reviews
  for insert to authenticated
  with check (reviewer_id = auth.uid() and public.can_review_order(order_id, reviewee_id));

create policy "saved_specialists_select" on public.saved_specialists
  for select to authenticated using (buyer_id = auth.uid());
create policy "saved_specialists_insert" on public.saved_specialists
  for insert to authenticated with check (buyer_id = auth.uid());
create policy "saved_specialists_delete" on public.saved_specialists
  for delete to authenticated using (buyer_id = auth.uid());

create policy "notifications_select" on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "analytics_events_insert" on public.analytics_events
  for insert with check (user_id is null or user_id = auth.uid());
create policy "analytics_events_select_admin" on public.analytics_events
  for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.conversations from anon, authenticated;
revoke insert, update, delete on public.conversation_participants from anon, authenticated;
revoke update, delete on public.messages from anon, authenticated;
revoke update, delete on public.reviews from anon, authenticated;
revoke insert, update, delete on public.notifications from anon, authenticated;
revoke update, delete on public.reports from anon, authenticated;
revoke update, delete on public.analytics_events from anon, authenticated;

-- Realtime: deliver new messages and notifications to subscribed clients
-- (Realtime enforces the RLS policies above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
