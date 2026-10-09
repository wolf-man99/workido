-- =============================================================================
-- Orders and payments: the heart of the marketplace.
--
-- * Orders are only created by create_service_order() (Mode A) or
--   accept_offer() (Mode B). Users have no direct INSERT/UPDATE rights.
-- * Every status change goes through the order_transitions table, which is
--   the database copy of src/lib/domain/orders/state-machine.ts. A parity
--   test (tests/integration/order-transitions.test.ts) keeps them identical.
-- * order_events is append-only history.
-- * Payment rows are written only by trusted server code (service role)
--   after provider verification; see 20261009000500_payments.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Platform settings (fees etc.). Fees default to zero; each order stores an
-- immutable snapshot of whatever applied when it was created.
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key text primary key constraint platform_settings_key check (key ~ '^[a-z0-9_]{2,60}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (key, value) values
  ('buyer_fee_bps', '0'::jsonb),
  ('specialist_fee_bps', '0'::jsonb);

create or replace function public.platform_fee_bps(p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::integer from public.platform_settings where key = p_key), 0);
$$;

-- Basis-point fee rounded half-up using integer arithmetic only. Mirrors
-- calculateFeeMinor() in src/lib/domain/money.ts.
create or replace function public.calculate_fee_minor(p_amount_minor bigint, p_bps integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case when p_bps <= 0 then 0::bigint else (p_amount_minor * p_bps + 5000) / 10000 end;
$$;

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique
    default ('WK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  specialist_id uuid not null references public.profiles (id) on delete restrict,
  source text not null constraint orders_source check (source in ('service', 'offer')),
  service_id uuid references public.services (id) on delete restrict,
  requirement_id uuid references public.requirements (id) on delete restrict,
  offer_id uuid unique references public.offers (id) on delete restrict,
  title text not null,
  -- Immutable copy of the agreed scope so later listing edits never change it.
  scope_snapshot jsonb not null,
  buyer_brief text constraint orders_brief_length check (char_length(buyer_brief) <= 5000),
  -- Gig price agreed with the specialist.
  price_minor bigint not null constraint orders_price_positive check (price_minor > 0),
  -- Fee charged to the buyer on top of the price (platform revenue, 0 by default).
  buyer_fee_minor bigint not null default 0 constraint orders_buyer_fee check (buyer_fee_minor >= 0),
  -- Fee withheld from the specialist payout (platform revenue, 0 by default).
  specialist_fee_minor bigint not null default 0 constraint orders_specialist_fee check (specialist_fee_minor >= 0),
  -- What the buyer pays.
  total_minor bigint generated always as (price_minor + buyer_fee_minor) stored,
  currency text not null constraint orders_currency check (currency ~ '^[A-Z]{3}$'),
  delivery_time_hours integer not null constraint orders_delivery_positive check (delivery_time_hours > 0),
  delivery_deadline timestamptz,
  revisions_included smallint not null constraint orders_revisions_included check (revisions_included between 0 and 10),
  revisions_used smallint not null default 0,
  status public.order_status not null default 'pending_payment',
  payout_status public.payout_status not null default 'not_due',
  payout_reference text constraint orders_payout_reference check (char_length(payout_reference) <= 200),
  paid_at timestamptz,
  accepted_at timestamptz,
  first_submitted_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text constraint orders_cancellation_reason check (char_length(cancellation_reason) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_distinct_parties check (buyer_id <> specialist_id),
  constraint orders_valid_origin check (
    (source = 'service' and service_id is not null and offer_id is null)
    or (source = 'offer' and offer_id is not null and requirement_id is not null)
  ),
  constraint orders_revisions_within_policy check (revisions_used between 0 and revisions_included)
);

create index orders_buyer_idx on public.orders (buyer_id, status, created_at desc);
create index orders_specialist_idx on public.orders (specialist_id, status, created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_service_idx on public.orders (service_id);
create index orders_requirement_idx on public.orders (requirement_id);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Payments, refunds and webhook idempotency log
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null constraint payments_provider check (provider in ('razorpay', 'dev')),
  provider_order_id text not null,
  provider_payment_id text,
  amount_minor bigint not null constraint payments_amount_positive check (amount_minor > 0),
  currency text not null constraint payments_currency check (currency ~ '^[A-Z]{3}$'),
  status public.payment_status not null default 'created',
  idempotency_key text not null unique,
  failure_reason text constraint payments_failure_reason check (char_length(failure_reason) <= 500),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_provider_order_unique unique (provider, provider_order_id),
  constraint payments_provider_payment_unique unique (provider, provider_payment_id)
);

create index payments_order_idx on public.payments (order_id, status);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  amount_minor bigint not null constraint refunds_amount_positive check (amount_minor > 0),
  currency text not null constraint refunds_currency check (currency ~ '^[A-Z]{3}$'),
  status public.refund_status not null default 'pending',
  provider_refund_id text unique,
  reason text constraint refunds_reason check (char_length(reason) <= 2000),
  failure_reason text constraint refunds_failure_reason check (char_length(failure_reason) <= 500),
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index refunds_order_idx on public.refunds (order_id);
create index refunds_status_idx on public.refunds (status);

create trigger refunds_set_updated_at
  before update on public.refunds
  for each row execute function public.set_updated_at();

-- Every inbound provider webhook is recorded once (provider_event_id is
-- unique), which makes webhook processing idempotent. No raw payloads or
-- payment instrument details are stored.
create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  processing_status text not null default 'received'
    constraint payment_webhook_events_status check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  error text constraint payment_webhook_events_error check (char_length(error) <= 1000),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint payment_webhook_events_unique unique (provider, provider_event_id)
);

-- ---------------------------------------------------------------------------
-- State machine definition (mirror of state-machine.ts)
-- ---------------------------------------------------------------------------
create table public.order_transitions (
  from_status public.order_status not null,
  action text not null,
  actor text not null constraint order_transitions_actor check (actor in ('buyer', 'specialist', 'admin', 'system')),
  to_status public.order_status not null,
  primary key (from_status, action, actor)
);

insert into public.order_transitions (from_status, action, actor, to_status) values
  ('pending_payment',    'mark_paid',        'system',     'paid'),
  ('pending_payment',    'cancel',           'buyer',      'cancelled'),
  ('pending_payment',    'cancel',           'specialist', 'cancelled'),
  ('paid',               'accept',           'specialist', 'in_progress'),
  ('paid',               'decline',          'specialist', 'refund_pending'),
  ('paid',               'cancel',           'buyer',      'refund_pending'),
  ('in_progress',        'submit',           'specialist', 'submitted'),
  ('in_progress',        'open_dispute',     'buyer',      'disputed'),
  ('in_progress',        'open_dispute',     'specialist', 'disputed'),
  ('submitted',          'approve',          'buyer',      'completed'),
  ('submitted',          'request_revision', 'buyer',      'revision_requested'),
  ('submitted',          'open_dispute',     'buyer',      'disputed'),
  ('submitted',          'open_dispute',     'specialist', 'disputed'),
  ('revision_requested', 'submit',           'specialist', 'submitted'),
  ('revision_requested', 'open_dispute',     'buyer',      'disputed'),
  ('revision_requested', 'open_dispute',     'specialist', 'disputed'),
  ('disputed',           'resolve_complete', 'admin',      'completed'),
  ('disputed',           'resolve_refund',   'admin',      'refund_pending'),
  ('disputed',           'resolve_resume',   'admin',      'in_progress'),
  ('cancelled',          'late_payment',     'system',     'refund_pending'),
  ('refund_pending',     'mark_refunded',    'system',     'refunded');

-- ---------------------------------------------------------------------------
-- Order history (append-only)
-- ---------------------------------------------------------------------------
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null constraint order_events_type check (event_type in (
    'order_created', 'payment_initiated', 'payment_verified', 'payment_failed',
    'specialist_accepted', 'work_started', 'specialist_declined', 'work_submitted',
    'revision_requested', 'deliverables_approved', 'order_completed', 'order_cancelled',
    'dispute_opened', 'dispute_resolved', 'refund_requested', 'refund_processed',
    'payout_marked'
  )),
  from_status public.order_status,
  to_status public.order_status,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Submissions & deliverables
-- ---------------------------------------------------------------------------
create table public.order_submissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  version integer not null,
  message text not null constraint order_submissions_message check (char_length(trim(message)) between 1 and 4000),
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint order_submissions_version_unique unique (order_id, version)
);

create table public.order_deliverables (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- NULL until the specialist submits; then linked to that submission.
  submission_id uuid references public.order_submissions (id) on delete set null,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  kind text not null constraint order_deliverables_kind check (kind in ('file', 'link')),
  storage_path text unique,
  external_url text constraint order_deliverables_url check (external_url ~* '^https?://' and char_length(external_url) <= 1000),
  filename text not null constraint order_deliverables_filename check (char_length(filename) between 1 and 255),
  content_type text,
  size_bytes bigint constraint order_deliverables_size check (size_bytes > 0),
  description text constraint order_deliverables_description check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  constraint order_deliverables_kind_fields check (
    (kind = 'file' and storage_path is not null and size_bytes is not null and content_type is not null)
    or (kind = 'link' and external_url is not null)
  )
);

create index order_deliverables_order_idx on public.order_deliverables (order_id, submission_id);

-- ---------------------------------------------------------------------------
-- Disputes
-- ---------------------------------------------------------------------------
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  opened_by uuid not null references public.profiles (id) on delete restrict,
  reason text not null constraint disputes_reason check (reason in (
    'quality', 'missed_deadline', 'scope_mismatch', 'no_response', 'payment', 'other'
  )),
  description text not null constraint disputes_description check (char_length(trim(description)) between 20 and 4000),
  status public.dispute_status not null default 'open',
  outcome public.dispute_outcome,
  resolution text constraint disputes_resolution check (char_length(resolution) <= 4000),
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint disputes_resolution_complete check (
    status = 'open' or (outcome is not null and resolution is not null and resolved_at is not null)
  )
);

create unique index disputes_one_open_per_order on public.disputes (order_id) where status = 'open';

create table public.dispute_attachments (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  storage_path text not null unique,
  filename text not null constraint dispute_attachments_filename check (char_length(filename) between 1 and 255),
  content_type text not null,
  size_bytes bigint not null constraint dispute_attachments_size check (size_bytes > 0),
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_order_participant(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders
    where id = p_order_id and auth.uid() in (buyer_id, specialist_id)
  );
$$;

create or replace function public.is_order_specialist(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.orders where id = p_order_id and specialist_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Internal transition engine. Not callable by API roles.
-- ---------------------------------------------------------------------------
create or replace function public.apply_order_transition(
  p_order_id uuid,
  p_actor text,
  p_action text,
  p_actor_user uuid,
  p_details jsonb default '{}'::jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_from public.order_status;
  v_to public.order_status;
  v_payment public.payments;
  v_note text := nullif(p_details ->> 'note', '');
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  v_from := v_order.status;

  select t.to_status into v_to
    from public.order_transitions t
   where t.from_status = v_from and t.action = p_action and t.actor = p_actor;

  if v_to is null then
    raise exception 'Action "%" is not allowed for % while the order is %', p_action, p_actor, v_from
      using errcode = '23514';
  end if;

  update public.orders o set
    status = v_to,
    paid_at = case when v_to = 'paid' then now() else o.paid_at end,
    accepted_at = case when p_action = 'accept' then now() else o.accepted_at end,
    delivery_deadline = case
      when p_action = 'accept' and o.delivery_deadline is null then now() + make_interval(hours => o.delivery_time_hours)
      else o.delivery_deadline end,
    submitted_at = case when p_action = 'submit' then now() else o.submitted_at end,
    first_submitted_at = case when p_action = 'submit' and o.first_submitted_at is null then now() else o.first_submitted_at end,
    revisions_used = case when p_action = 'request_revision' then o.revisions_used + 1 else o.revisions_used end,
    completed_at = case when v_to = 'completed' then now() else o.completed_at end,
    payout_status = case
      when v_to = 'completed' then 'pending'::public.payout_status
      when v_to in ('refund_pending', 'refunded') then 'not_due'::public.payout_status
      else o.payout_status end,
    cancelled_at = case when v_to = 'cancelled' or (p_action in ('cancel', 'decline')) then now() else o.cancelled_at end,
    cancellation_reason = case when p_action in ('cancel', 'decline') then v_note else o.cancellation_reason end
  where o.id = v_order.id
  returning * into v_order;

  -- When money must go back to the buyer, open a refund record against the
  -- verified payment. The refund itself is executed through the payment
  -- provider and confirmed by apply_refund_success().
  if v_to = 'refund_pending' then
    select * into v_payment from public.payments
     where order_id = v_order.id and status = 'succeeded'
     order by created_at desc limit 1;
    if found and not exists (
      select 1 from public.refunds r
      where r.payment_id = v_payment.id and r.status in ('pending', 'processing', 'succeeded')
    ) then
      insert into public.refunds (payment_id, order_id, amount_minor, currency, status, reason, requested_by)
      values (v_payment.id, v_order.id, v_payment.amount_minor, v_payment.currency, 'pending',
              coalesce(v_note, p_action), p_actor_user);
    end if;
  end if;

  insert into public.order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  select v_order.id, p_actor_user, e.event_type, v_from, v_to, coalesce(p_details, '{}'::jsonb)
  from unnest(case p_action
      when 'mark_paid' then array['payment_verified']
      when 'accept' then array['specialist_accepted', 'work_started']
      when 'decline' then array['specialist_declined', 'refund_requested']
      when 'submit' then array['work_submitted']
      when 'request_revision' then array['revision_requested']
      when 'approve' then array['deliverables_approved', 'order_completed']
      when 'cancel' then case when v_to = 'refund_pending'
                              then array['order_cancelled', 'refund_requested']
                              else array['order_cancelled'] end
      when 'open_dispute' then array['dispute_opened']
      when 'resolve_complete' then array['dispute_resolved', 'order_completed']
      when 'resolve_refund' then array['dispute_resolved', 'refund_requested']
      when 'resolve_resume' then array['dispute_resolved', 'work_started']
      when 'late_payment' then array['payment_verified', 'refund_requested']
      when 'mark_refunded' then array['refund_processed']
      else array[]::text[]
    end) as e(event_type);

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- User-facing order actions (accept, decline, submit, request_revision,
-- approve, cancel). Determines the caller's role on the order and applies
-- action-specific business rules before delegating to the transition engine.
-- ---------------------------------------------------------------------------
create or replace function public.perform_order_action(
  p_order_id uuid,
  p_action text,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_actor text;
  v_pending integer;
  v_version integer;
  v_submission uuid;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_action not in ('accept', 'decline', 'submit', 'request_revision', 'approve', 'cancel') then
    raise exception 'Unknown order action "%"', p_action using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or auth.uid() not in (v_order.buyer_id, v_order.specialist_id) then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if not public.current_user_is_active() then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;

  v_actor := case when auth.uid() = v_order.buyer_id then 'buyer' else 'specialist' end;

  if p_action = 'request_revision' and v_actor = 'buyer' and v_order.status = 'submitted' then
    if v_order.revisions_used >= v_order.revisions_included then
      raise exception 'All % included revision(s) have been used. Message the specialist or open a dispute if the work does not match the agreed scope.', v_order.revisions_included
        using errcode = '23514';
    end if;
    if v_note is null or char_length(v_note) < 10 then
      raise exception 'Describe what needs to change (at least 10 characters)' using errcode = '23514';
    end if;
  end if;

  if p_action = 'submit' and v_actor = 'specialist' and v_order.status in ('in_progress', 'revision_requested') then
    if v_note is null then
      raise exception 'Add a delivery message for the buyer' using errcode = '23514';
    end if;
    select count(*) into v_pending from public.order_deliverables d
     where d.order_id = v_order.id and d.submission_id is null;
    if v_pending = 0 then
      raise exception 'Upload at least one file or link before submitting' using errcode = '23514';
    end if;
    select coalesce(max(s.version), 0) + 1 into v_version from public.order_submissions s where s.order_id = v_order.id;
    insert into public.order_submissions (order_id, version, message, submitted_by)
      values (v_order.id, v_version, left(v_note, 4000), auth.uid())
      returning id into v_submission;
    update public.order_deliverables d set submission_id = v_submission
     where d.order_id = v_order.id and d.submission_id is null;
  end if;

  return public.apply_order_transition(
    v_order.id, v_actor, p_action, auth.uid(),
    jsonb_strip_nulls(jsonb_build_object('note', left(v_note, 2000), 'version', v_version))
  );
end;
$$;

create or replace function public.open_dispute(p_order_id uuid, p_reason text, p_description text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_dispute uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found or auth.uid() not in (v_order.buyer_id, v_order.specialist_id) then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if not public.current_user_is_active() then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;

  perform public.apply_order_transition(
    v_order.id,
    case when auth.uid() = v_order.buyer_id then 'buyer' else 'specialist' end,
    'open_dispute',
    auth.uid(),
    jsonb_build_object('reason', p_reason)
  );

  insert into public.disputes (order_id, opened_by, reason, description)
    values (v_order.id, auth.uid(), p_reason, trim(p_description))
    returning id into v_dispute;
  return v_dispute;
end;
$$;

create or replace function public.resolve_dispute(p_dispute_id uuid, p_outcome public.dispute_outcome, p_resolution text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispute public.disputes;
  v_action text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if coalesce(char_length(trim(p_resolution)), 0) < 10 then
    raise exception 'Record the resolution decision (at least 10 characters)' using errcode = '23514';
  end if;
  select * into v_dispute from public.disputes where id = p_dispute_id for update;
  if not found or v_dispute.status <> 'open' then
    raise exception 'Open dispute not found' using errcode = 'P0002';
  end if;

  v_action := case p_outcome
    when 'complete_order' then 'resolve_complete'
    when 'refund_buyer' then 'resolve_refund'
    when 'resume_work' then 'resolve_resume'
  end;

  perform public.apply_order_transition(
    v_dispute.order_id, 'admin', v_action, auth.uid(),
    jsonb_build_object('dispute_id', v_dispute.id, 'outcome', p_outcome, 'note', left(trim(p_resolution), 2000))
  );

  update public.disputes set
    status = 'resolved',
    outcome = p_outcome,
    resolution = trim(p_resolution),
    resolved_by = auth.uid(),
    resolved_at = now()
  where id = v_dispute.id;

  insert into public.admin_actions (admin_id, action, target_type, target_id, reason, metadata)
    values (auth.uid(), 'resolve_dispute', 'dispute', v_dispute.id, trim(p_resolution),
            jsonb_build_object('order_id', v_dispute.order_id, 'outcome', p_outcome));
end;
$$;

-- ---------------------------------------------------------------------------
-- Order creation
-- ---------------------------------------------------------------------------

-- Mode A: buy a predefined gig. Price, scope and policy are snapshotted from
-- the listing on the server; the client never supplies a price.
create or replace function public.create_service_order(p_service_id uuid, p_brief text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services;
  v_availability public.availability_status;
  v_category text;
  v_order uuid;
  v_buyer_fee bigint;
  v_specialist_fee bigint;
  v_brief text := trim(coalesce(p_brief, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.current_user_is_active() then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;

  select * into v_service from public.services where id = p_service_id;
  if not found or v_service.publication_status <> 'published' or not public.is_public_specialist(v_service.specialist_id) then
    raise exception 'This service is not available' using errcode = 'P0002';
  end if;
  if v_service.specialist_id = auth.uid() then
    raise exception 'You cannot order your own service' using errcode = '23514';
  end if;

  select availability_status into v_availability from public.specialist_profiles where user_id = v_service.specialist_id;
  if v_availability = 'unavailable' then
    raise exception 'This specialist is not taking new orders right now' using errcode = '23514';
  end if;
  if char_length(v_brief) < 10 then
    raise exception 'Tell the specialist what you need (at least 10 characters)' using errcode = '23514';
  end if;

  select name into v_category from public.categories where id = v_service.category_id;

  -- Anyone who places an order holds the buyer capability.
  insert into public.user_roles (user_id, role) values (auth.uid(), 'buyer')
    on conflict (user_id, role) do nothing;

  v_buyer_fee := public.calculate_fee_minor(v_service.price_minor, public.platform_fee_bps('buyer_fee_bps'));
  v_specialist_fee := public.calculate_fee_minor(v_service.price_minor, public.platform_fee_bps('specialist_fee_bps'));

  insert into public.orders (
    buyer_id, specialist_id, source, service_id, title, scope_snapshot, buyer_brief,
    price_minor, buyer_fee_minor, specialist_fee_minor, currency, delivery_time_hours, revisions_included
  ) values (
    auth.uid(), v_service.specialist_id, 'service', v_service.id, v_service.title,
    jsonb_build_object(
      'source', 'service',
      'service_title', v_service.title,
      'service_slug', v_service.slug,
      'category', v_category,
      'description', v_service.description,
      'deliverables', v_service.deliverables,
      'buyer_instructions', v_service.buyer_instructions,
      'delivery_time_hours', v_service.delivery_time_hours,
      'included_revisions', v_service.included_revisions
    ),
    left(v_brief, 5000),
    v_service.price_minor, v_buyer_fee, v_specialist_fee, v_service.currency,
    v_service.delivery_time_hours, v_service.included_revisions
  ) returning id into v_order;

  insert into public.order_events (order_id, actor_id, event_type, to_status, metadata)
    values (v_order, auth.uid(), 'order_created', 'pending_payment', jsonb_build_object('source', 'service'));

  return v_order;
end;
$$;

-- Mode B: accept an offer on your requirement. Creates the order from the
-- offer and requirement snapshot, declines competing offers, marks hired.
create or replace function public.accept_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_req public.requirements;
  v_category text;
  v_order uuid;
  v_buyer_fee bigint;
  v_specialist_fee bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.current_user_is_active() then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;

  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  select * into v_req from public.requirements where id = v_offer.requirement_id for update;
  if v_req.buyer_id <> auth.uid() then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'This offer is no longer available' using errcode = '23514';
  end if;
  if v_req.status <> 'open' then
    raise exception 'This requirement is no longer open' using errcode = '23514';
  end if;
  if not public.is_public_specialist(v_offer.specialist_id) then
    raise exception 'This specialist is no longer available' using errcode = '23514';
  end if;

  select name into v_category from public.categories where id = v_req.category_id;

  insert into public.user_roles (user_id, role) values (auth.uid(), 'buyer')
    on conflict (user_id, role) do nothing;

  v_buyer_fee := public.calculate_fee_minor(v_offer.proposed_price_minor, public.platform_fee_bps('buyer_fee_bps'));
  v_specialist_fee := public.calculate_fee_minor(v_offer.proposed_price_minor, public.platform_fee_bps('specialist_fee_bps'));

  insert into public.orders (
    buyer_id, specialist_id, source, requirement_id, offer_id, title, scope_snapshot, buyer_brief,
    price_minor, buyer_fee_minor, specialist_fee_minor, currency, delivery_time_hours, revisions_included
  ) values (
    auth.uid(), v_offer.specialist_id, 'offer', v_req.id, v_offer.id, v_req.title,
    jsonb_build_object(
      'source', 'offer',
      'category', v_category,
      'description', v_req.description,
      'deliverables', v_req.deliverables,
      'quantity', v_req.quantity,
      'reference_links', to_jsonb(v_req.reference_links),
      'offer_message', v_offer.message,
      'delivery_time_hours', v_offer.delivery_time_hours,
      'included_revisions', v_offer.revisions_included,
      'requirement_deadline', v_req.deadline_at
    ),
    v_req.description,
    v_offer.proposed_price_minor, v_buyer_fee, v_specialist_fee, v_offer.currency,
    v_offer.delivery_time_hours, v_offer.revisions_included
  ) returning id into v_order;

  update public.offers set status = 'accepted', responded_at = now() where id = v_offer.id;
  update public.offers set status = 'declined', responded_at = now()
   where requirement_id = v_req.id and id <> v_offer.id and status = 'pending';
  update public.requirements set status = 'hired' where id = v_req.id;

  insert into public.order_events (order_id, actor_id, event_type, to_status, metadata)
    values (v_order, auth.uid(), 'order_created', 'pending_payment',
            jsonb_build_object('source', 'offer', 'offer_id', v_offer.id));

  return v_order;
end;
$$;

create or replace function public.decline_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found or not public.owns_requirement(v_offer.requirement_id) then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'This offer is no longer pending' using errcode = '23514';
  end if;
  update public.offers set status = 'declined', responded_at = now() where id = v_offer.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deliverable upload rules
-- ---------------------------------------------------------------------------
create or replace function public.order_deliverables_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if public.is_direct_user_request() then
    select * into v_order from public.orders where id = new.order_id;
    if v_order.specialist_id is distinct from auth.uid() then
      raise exception 'Only the assigned specialist can add deliverables' using errcode = '42501';
    end if;
    if v_order.status not in ('in_progress', 'revision_requested') then
      raise exception 'Deliverables can only be added while work is in progress' using errcode = '23514';
    end if;
    if new.submission_id is not null then
      raise exception 'Deliverables are attached to a submission when you submit' using errcode = '42501';
    end if;
    if new.kind = 'file' and new.storage_path not like (new.order_id::text || '/deliverables/%') then
      raise exception 'Invalid deliverable storage path' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger order_deliverables_before_insert
  before insert on public.order_deliverables
  for each row execute function public.order_deliverables_before_insert();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.platform_settings enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.order_transitions enable row level security;
alter table public.order_events enable row level security;
alter table public.order_submissions enable row level security;
alter table public.order_deliverables enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_attachments enable row level security;

create policy "platform_settings_select" on public.platform_settings for select using (true);
create policy "platform_settings_admin_update" on public.platform_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "order_transitions_select" on public.order_transitions for select using (true);

-- Orders: participants and admins can read. No direct writes.
create policy "orders_select_participants" on public.orders
  for select to authenticated
  using (auth.uid() in (buyer_id, specialist_id) or public.is_admin());

-- Payments: the buyer and admins can read. Writes only via service role.
create policy "payments_select" on public.payments
  for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
    or public.is_admin()
  );

create policy "refunds_select" on public.refunds
  for select to authenticated
  using (public.is_order_participant(order_id) or public.is_admin());

create policy "payment_webhook_events_admin" on public.payment_webhook_events
  for select to authenticated using (public.is_admin());

create policy "order_events_select" on public.order_events
  for select to authenticated
  using (public.is_order_participant(order_id) or public.is_admin());

create policy "order_submissions_select" on public.order_submissions
  for select to authenticated
  using (public.is_order_participant(order_id) or public.is_admin());

-- Buyers see deliverables once submitted; the specialist also sees drafts.
create policy "order_deliverables_select" on public.order_deliverables
  for select to authenticated
  using (
    public.is_order_specialist(order_id)
    or (submission_id is not null and public.is_order_participant(order_id))
    or public.is_admin()
  );
create policy "order_deliverables_insert_specialist" on public.order_deliverables
  for insert to authenticated
  with check (uploaded_by = auth.uid() and public.is_order_specialist(order_id));
create policy "order_deliverables_delete_draft" on public.order_deliverables
  for delete to authenticated
  using (uploaded_by = auth.uid() and submission_id is null);

create policy "disputes_select" on public.disputes
  for select to authenticated
  using (public.is_order_participant(order_id) or public.is_admin());

create policy "dispute_attachments_select" on public.dispute_attachments
  for select to authenticated
  using (
    exists (select 1 from public.disputes d where d.id = dispute_id and public.is_order_participant(d.order_id))
    or public.is_admin()
  );
create policy "dispute_attachments_insert" on public.dispute_attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.disputes d
      where d.id = dispute_id and d.status = 'open' and public.is_order_participant(d.order_id)
    )
  );

-- Defence in depth: API roles have no write grants on these tables at all.
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;
revoke insert, update, delete on public.refunds from anon, authenticated;
revoke insert, update, delete on public.payment_webhook_events from anon, authenticated;
revoke insert, update, delete on public.order_events from anon, authenticated;
revoke insert, update, delete on public.order_transitions from anon, authenticated;
revoke insert, update, delete on public.order_submissions from anon, authenticated;
revoke insert, update, delete on public.disputes from anon, authenticated;

-- The internal engine must never be reachable through the Data API.
revoke execute on function public.apply_order_transition(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
