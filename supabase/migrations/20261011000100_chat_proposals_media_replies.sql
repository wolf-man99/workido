-- =============================================================================
-- Chat upgrades
--
--  * Proposals: in a pre-order chat the specialist sends a proposal (scope,
--    price, delivery time, revisions). The buyer accepts (an order is created
--    for them to pay), declines, or makes ONE counter-offer on price and/or
--    delivery time, which the specialist accepts (order created) or declines
--    (the original proposal stands). One open proposal per chat; proposals
--    expire after 7 days (checked when acted on).
--  * Attachments in pre-order chats (private chat-files bucket) and voice
--    notes in every chat (audio attachments with a duration).
--  * Replies to a specific message.
--  * Messages that seem to share contact or off-platform payment details are
--    flagged, so the app can remind both sides to keep deals on Workido and
--    admins can review them.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Formatting helpers (mirror src/lib/domain/money.ts and src/lib/format.ts)
-- ---------------------------------------------------------------------------
create or replace function public.format_money_minor(p_amount bigint, p_currency text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_whole text := (abs(p_amount) / 100)::text;
  v_fraction integer := abs(p_amount) % 100;
  v_grouped text;
begin
  if p_currency = 'INR' and char_length(v_whole) > 3 then
    v_grouped := regexp_replace(left(v_whole, char_length(v_whole) - 3), '(\d)(?=(\d\d)+$)', '\1,', 'g') || ',' || right(v_whole, 3);
  else
    v_grouped := regexp_replace(v_whole, '(\d)(?=(\d{3})+$)', '\1,', 'g');
  end if;
  return case when p_amount < 0 then '-' else '' end
    || case p_currency when 'INR' then '₹' when 'USD' then '$' when 'EUR' then '€' when 'GBP' then '£' else p_currency || ' ' end
    || v_grouped
    || case when v_fraction > 0 then '.' || lpad(v_fraction::text, 2, '0') else '' end;
end;
$$;

create or replace function public.format_duration_hours(p_hours integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_hours < 24 then p_hours || ' hour' || case when p_hours = 1 then '' else 's' end
    when p_hours % 24 = 0 then (p_hours / 24) || ' day' || case when p_hours = 24 then '' else 's' end
    else p_hours || ' hours'
  end;
$$;

-- Phone numbers, emails, messaging apps, UPI IDs and "pay outside" phrases.
-- Mirrors src/lib/chat/contact-details.ts.
create or replace function public.mentions_contact_details(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_text, '') ~* (
    '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
    || '|(\+?\d[\s().-]*){10,}'
    || '|\m(whats\s*app|watsapp|telegram|skype|wa\.me|t\.me|signal app)\M'
    || '|\m(g\s*pay|google pay|phone\s*pe|paytm|upi|bank transfer|neft|imps)\M'
    || '|\m[a-z0-9._-]+@(ok)?(axis|hdfcbank|icici|sbi|ybl|paytm|upi|apl|ibl)\M'
    || '|\mpay (me )?(directly|outside|offline)\M'
    || '|\moutside (of )?(the )?(platform|workido|site|app)\M'
  );
$$;

-- ---------------------------------------------------------------------------
-- Proposals
-- ---------------------------------------------------------------------------
create table public.chat_proposals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  specialist_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  title text not null constraint chat_proposals_title check (char_length(trim(title)) between 5 and 120),
  description text not null constraint chat_proposals_description check (char_length(trim(description)) between 20 and 5000),
  deliverables text not null constraint chat_proposals_deliverables check (char_length(trim(deliverables)) between 5 and 2000),
  price_minor bigint not null constraint chat_proposals_price check (price_minor between 10000 and 100000000),
  currency text not null default 'INR' constraint chat_proposals_currency check (currency ~ '^[A-Z]{3}$'),
  delivery_time_hours integer not null constraint chat_proposals_delivery check (delivery_time_hours between 1 and 2160),
  revisions_included smallint not null constraint chat_proposals_revisions check (revisions_included between 0 and 10),
  status text not null default 'pending'
    constraint chat_proposals_status check (status in ('pending', 'countered', 'accepted', 'declined', 'withdrawn')),
  counter_price_minor bigint constraint chat_proposals_counter_price check (counter_price_minor between 10000 and 100000000),
  counter_delivery_time_hours integer constraint chat_proposals_counter_delivery check (counter_delivery_time_hours between 1 and 2160),
  counter_note text constraint chat_proposals_counter_note check (char_length(counter_note) <= 1000),
  countered_at timestamptz,
  counter_declined_at timestamptz,
  accepted_terms text constraint chat_proposals_accepted_terms check (accepted_terms in ('original', 'counter')),
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_proposals_parties check (buyer_id <> specialist_id),
  constraint chat_proposals_counter_complete check ((counter_price_minor is null) = (counter_delivery_time_hours is null))
);

create index chat_proposals_conversation_idx on public.chat_proposals (conversation_id, created_at desc);

create trigger chat_proposals_set_updated_at
  before update on public.chat_proposals
  for each row execute function public.set_updated_at();

alter table public.chat_proposals enable row level security;

-- Read-only for the two people in the chat; every change goes through the
-- functions below.
create policy "chat_proposals_select" on public.chat_proposals
  for select to authenticated
  using (public.is_conversation_participant(conversation_id) or public.is_admin());

-- Orders can come from an accepted proposal. The order keeps its own
-- snapshot, so it survives the proposal (and its chat) being deleted.
alter table public.orders drop constraint orders_source;
alter table public.orders add constraint orders_source check (source in ('service', 'offer', 'proposal'));
alter table public.orders drop constraint orders_valid_origin;
alter table public.orders add constraint orders_valid_origin check (
  (source = 'service' and service_id is not null and offer_id is null)
  or (source = 'offer' and offer_id is not null and requirement_id is not null)
  or (source = 'proposal' and offer_id is null)
);
alter table public.orders add column proposal_id uuid unique references public.chat_proposals (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Messages: replies, proposal events, voice notes, contact flags
-- ---------------------------------------------------------------------------
alter table public.messages
  add column reply_to_id uuid references public.messages (id) on delete set null,
  add column proposal_id uuid references public.chat_proposals (id) on delete set null,
  add column attachment_duration_seconds integer
    constraint messages_attachment_duration check (attachment_duration_seconds between 1 and 600),
  add column contact_flagged boolean not null default false;

create index messages_contact_flagged_idx on public.messages (created_at desc) where contact_flagged;

create or replace function public.messages_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_conversation public.conversations;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;
  if public.is_direct_user_request() then
    if new.message_type = 'system' then
      raise exception 'System messages cannot be sent by users' using errcode = '42501';
    end if;
    if new.proposal_id is not null then
      raise exception 'Proposals are sent with the proposal form' using errcode = '42501';
    end if;
    new.sender_id := auth.uid();
    new.created_at := now();
    -- Order chats store files with the order; pre-order chats in chat-files.
    if new.attachment_path is not null
       and new.attachment_path not like coalesce(v_conversation.order_id::text || '/messages/', v_conversation.id::text || '/') || '%' then
      raise exception 'Invalid attachment path' using errcode = '42501';
    end if;
  end if;
  if new.reply_to_id is not null and not exists (
    select 1 from public.messages where id = new.reply_to_id and conversation_id = new.conversation_id
  ) then
    raise exception 'You can only reply to a message in this conversation' using errcode = '23514';
  end if;
  if coalesce(new.attachment_type, '') not like 'audio/%' then
    new.attachment_duration_seconds := null;
  end if;
  new.contact_flagged := new.message_type in ('text', 'file') and public.mentions_contact_details(new.body);
  return new;
end;
$$;

-- Unread counts include proposal events from the other person.
create or replace function public.list_my_conversations()
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
        and (m.message_type <> 'system' or m.proposal_id is not null)
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

-- Orders from a proposal announce themselves through the proposal events.
create or replace function public.orders_note_in_enquiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source = 'proposal' then
    return new;
  end if;
  insert into public.messages (conversation_id, sender_id, message_type, body)
  select c.id, null, 'system',
         'Order ' || new.order_number || ' created for "' || new.title || '". Payment, updates and delivery continue on the order page.'
    from public.conversations c
   where c.kind = 'enquiry' and c.buyer_id = new.buyer_id and c.specialist_id = new.specialist_id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Proposal functions
-- ---------------------------------------------------------------------------

-- Internal: creates the order for an accepted proposal at the given terms.
create or replace function public.create_order_from_proposal(
  p_proposal public.chat_proposals,
  p_price_minor bigint,
  p_delivery_time_hours integer,
  p_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order uuid;
  v_category text;
  v_service_slug text;
  v_counter boolean := p_price_minor <> p_proposal.price_minor or p_delivery_time_hours <> p_proposal.delivery_time_hours;
begin
  select c.name, s.slug into v_category, v_service_slug
    from public.services s left join public.categories c on c.id = s.category_id
   where s.id = p_proposal.service_id;

  insert into public.user_roles (user_id, role) values (p_proposal.buyer_id, 'buyer')
    on conflict (user_id, role) do nothing;

  insert into public.orders (
    buyer_id, specialist_id, source, service_id, proposal_id, title, scope_snapshot,
    price_minor, buyer_fee_minor, specialist_fee_minor, currency, delivery_time_hours, revisions_included
  ) values (
    p_proposal.buyer_id, p_proposal.specialist_id, 'proposal', p_proposal.service_id, p_proposal.id, p_proposal.title,
    jsonb_build_object(
      'source', 'proposal',
      'category', v_category,
      'service_slug', v_service_slug,
      'description', p_proposal.description,
      'deliverables', p_proposal.deliverables,
      'delivery_time_hours', p_delivery_time_hours,
      'included_revisions', p_proposal.revisions_included,
      'agreed_terms', case when v_counter then 'counter' else 'original' end,
      'proposed_price_minor', p_proposal.price_minor,
      'proposed_delivery_time_hours', p_proposal.delivery_time_hours,
      'counter_note', p_proposal.counter_note
    ),
    p_price_minor,
    public.calculate_fee_minor(p_price_minor, public.platform_fee_bps('buyer_fee_bps')),
    public.calculate_fee_minor(p_price_minor, public.platform_fee_bps('specialist_fee_bps')),
    p_proposal.currency, p_delivery_time_hours, p_proposal.revisions_included
  ) returning id into v_order;

  insert into public.order_events (order_id, actor_id, event_type, to_status, metadata)
    values (v_order, p_actor, 'order_created', 'pending_payment',
            jsonb_build_object('source', 'proposal', 'proposal_id', p_proposal.id, 'agreed_terms', case when v_counter then 'counter' else 'original' end));
  return v_order;
end;
$$;

-- Internal: records a proposal event in the chat and notifies the other person.
create or replace function public.post_proposal_event(
  p_proposal public.chat_proposals,
  p_actor uuid,
  p_body text,
  p_notify_type text,
  p_notify_title text,
  p_notify_body text,
  p_link_path text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid := case when p_actor = p_proposal.buyer_id then p_proposal.specialist_id else p_proposal.buyer_id end;
begin
  insert into public.messages (conversation_id, sender_id, message_type, body, proposal_id)
    values (p_proposal.conversation_id, p_actor, 'system', p_body, p_proposal.id);
  if p_notify_type is not null then
    perform public.notify_user(v_recipient, p_notify_type, p_notify_title, p_notify_body,
      coalesce(p_link_path, '/dashboard/messages/' || p_proposal.conversation_id::text), 'conversation', p_proposal.conversation_id);
  end if;
end;
$$;

-- Loads a proposal for an action by one of its two parties (locks the row).
create or replace function public.lock_proposal_for(p_proposal_id uuid, p_role text)
returns public.chat_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.chat_proposals;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.current_user_is_active() then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;
  select * into v_proposal from public.chat_proposals where id = p_proposal_id for update;
  if not found or auth.uid() not in (v_proposal.buyer_id, v_proposal.specialist_id) then
    raise exception 'Proposal not found' using errcode = 'P0002';
  end if;
  if p_role = 'buyer' and auth.uid() <> v_proposal.buyer_id then
    raise exception 'Only the buyer can do that' using errcode = '42501';
  end if;
  if p_role = 'specialist' and auth.uid() <> v_proposal.specialist_id then
    raise exception 'Only the specialist can do that' using errcode = '42501';
  end if;
  return v_proposal;
end;
$$;

create or replace function public.send_proposal(
  p_conversation_id uuid,
  p_title text,
  p_description text,
  p_deliverables text,
  p_price_minor bigint,
  p_delivery_time_hours integer,
  p_revisions_included integer,
  p_service_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_conversation public.conversations;
  v_service_id uuid;
  v_currency text := 'INR';
  v_replaced boolean := false;
  v_proposal public.chat_proposals;
  v_name text;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.current_user_is_active() then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;
  select * into v_conversation from public.conversations where id = p_conversation_id for update;
  if not found or not public.is_conversation_participant(p_conversation_id) then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  if v_conversation.kind <> 'enquiry' then
    raise exception 'Proposals are sent in the chat before an order' using errcode = '23514';
  end if;
  if v_conversation.specialist_id <> v_user then
    raise exception 'Only the specialist in this chat can send a proposal' using errcode = '42501';
  end if;
  if not public.is_public_specialist(v_user) then
    raise exception 'Publish your specialist profile before sending proposals' using errcode = '23514';
  end if;

  v_service_id := coalesce(p_service_id, v_conversation.service_id);
  if v_service_id is not null then
    select currency into v_currency from public.services where id = v_service_id and specialist_id = v_user;
    if not found then
      raise exception 'You can only attach your own gig to a proposal' using errcode = '23514';
    end if;
  end if;

  -- One open proposal per chat: a new one replaces the previous.
  update public.chat_proposals set status = 'withdrawn', responded_at = now()
   where conversation_id = v_conversation.id and status in ('pending', 'countered');
  v_replaced := found;

  insert into public.chat_proposals (
    conversation_id, buyer_id, specialist_id, service_id, title, description, deliverables,
    price_minor, currency, delivery_time_hours, revisions_included
  ) values (
    v_conversation.id, v_conversation.buyer_id, v_user, v_service_id, trim(p_title), trim(p_description), trim(p_deliverables),
    p_price_minor, coalesce(v_currency, 'INR'), p_delivery_time_hours, p_revisions_included
  ) returning * into v_proposal;

  select full_name into v_name from public.profiles where id = v_user;
  perform public.post_proposal_event(v_proposal, v_user,
    case when v_replaced then 'Sent an updated proposal: ' else 'Sent a proposal: ' end
      || v_proposal.title || ' · ' || public.format_money_minor(v_proposal.price_minor, v_proposal.currency)
      || ' · ' || public.format_duration_hours(v_proposal.delivery_time_hours),
    'proposal_received', 'New proposal from ' || coalesce(v_name, 'a specialist'),
    v_proposal.title || ' · ' || public.format_money_minor(v_proposal.price_minor, v_proposal.currency));
  return v_proposal.id;
end;
$$;

create or replace function public.accept_proposal(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.chat_proposals := public.lock_proposal_for(p_proposal_id, 'buyer');
  v_order uuid;
  v_order_number text;
  v_name text;
begin
  if v_proposal.status <> 'pending' then
    raise exception 'This proposal can no longer be accepted' using errcode = '23514';
  end if;
  if v_proposal.expires_at < now() then
    raise exception 'This proposal has expired. Ask the specialist for a new one.' using errcode = '23514';
  end if;
  if not public.is_public_specialist(v_proposal.specialist_id) then
    raise exception 'This specialist isn''t taking orders right now' using errcode = '23514';
  end if;

  v_order := public.create_order_from_proposal(v_proposal, v_proposal.price_minor, v_proposal.delivery_time_hours, auth.uid());
  update public.chat_proposals set status = 'accepted', accepted_terms = 'original', responded_at = now()
   where id = v_proposal.id returning * into v_proposal;

  select order_number into v_order_number from public.orders where id = v_order;
  select full_name into v_name from public.profiles where id = v_proposal.buyer_id;
  perform public.post_proposal_event(v_proposal, auth.uid(),
    'Accepted the proposal. Order ' || v_order_number || ' is waiting for payment.',
    'proposal_accepted', coalesce(v_name, 'The buyer') || ' accepted your proposal',
    v_proposal.title || ' · The order starts once it''s paid.', '/dashboard/orders/' || v_order::text);
  return v_order;
end;
$$;

create or replace function public.counter_proposal(
  p_proposal_id uuid,
  p_price_minor bigint,
  p_delivery_time_hours integer,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.chat_proposals := public.lock_proposal_for(p_proposal_id, 'buyer');
  v_name text;
begin
  if v_proposal.counter_price_minor is not null then
    raise exception 'You''ve already made your counter-offer on this proposal' using errcode = '23514';
  end if;
  if v_proposal.status <> 'pending' then
    raise exception 'This proposal can no longer be countered' using errcode = '23514';
  end if;
  if v_proposal.expires_at < now() then
    raise exception 'This proposal has expired. Ask the specialist for a new one.' using errcode = '23514';
  end if;
  if p_price_minor is null or p_price_minor not between 10000 and 100000000 then
    raise exception 'Enter a price between ₹100 and ₹10,00,000' using errcode = '23514';
  end if;
  if p_delivery_time_hours is null or p_delivery_time_hours not between 1 and 2160 then
    raise exception 'Enter a delivery time between 1 hour and 90 days' using errcode = '23514';
  end if;
  if p_price_minor = v_proposal.price_minor and p_delivery_time_hours = v_proposal.delivery_time_hours then
    raise exception 'Change the price or the delivery time to make a counter-offer' using errcode = '23514';
  end if;
  if char_length(coalesce(p_note, '')) > 1000 then
    raise exception 'Keep your note under 1,000 characters' using errcode = '23514';
  end if;

  update public.chat_proposals set
    status = 'countered',
    counter_price_minor = p_price_minor,
    counter_delivery_time_hours = p_delivery_time_hours,
    counter_note = nullif(trim(coalesce(p_note, '')), ''),
    countered_at = now(),
    expires_at = now() + interval '7 days'
  where id = v_proposal.id returning * into v_proposal;

  select full_name into v_name from public.profiles where id = v_proposal.buyer_id;
  perform public.post_proposal_event(v_proposal, auth.uid(),
    'Counter-offer: ' || public.format_money_minor(p_price_minor, v_proposal.currency) || ' · ' || public.format_duration_hours(p_delivery_time_hours),
    'proposal_countered', coalesce(v_name, 'The buyer') || ' made a counter-offer',
    v_proposal.title || ' · ' || public.format_money_minor(p_price_minor, v_proposal.currency) || ', ' || public.format_duration_hours(p_delivery_time_hours));
end;
$$;

create or replace function public.respond_to_counter(p_proposal_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.chat_proposals := public.lock_proposal_for(p_proposal_id, 'specialist');
  v_order uuid;
  v_order_number text;
  v_name text;
begin
  if v_proposal.status <> 'countered' then
    raise exception 'There is no counter-offer waiting for your answer' using errcode = '23514';
  end if;
  select full_name into v_name from public.profiles where id = v_proposal.specialist_id;

  if not p_accept then
    update public.chat_proposals set status = 'pending', counter_declined_at = now(), responded_at = now()
     where id = v_proposal.id returning * into v_proposal;
    perform public.post_proposal_event(v_proposal, auth.uid(),
      'Declined the counter-offer. The original proposal still stands.',
      'proposal_counter_declined', coalesce(v_name, 'The specialist') || ' declined your counter-offer',
      'You can still accept the original proposal: ' || public.format_money_minor(v_proposal.price_minor, v_proposal.currency) || '.');
    return null;
  end if;

  if v_proposal.expires_at < now() then
    raise exception 'This counter-offer has expired. Send a new proposal instead.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles where id = v_proposal.buyer_id and account_status = 'active') then
    raise exception 'This buyer can''t place orders right now' using errcode = '23514';
  end if;

  v_order := public.create_order_from_proposal(v_proposal, v_proposal.counter_price_minor, v_proposal.counter_delivery_time_hours, auth.uid());
  update public.chat_proposals set status = 'accepted', accepted_terms = 'counter', responded_at = now()
   where id = v_proposal.id returning * into v_proposal;

  select order_number into v_order_number from public.orders where id = v_order;
  perform public.post_proposal_event(v_proposal, auth.uid(),
    'Accepted the counter-offer. Order ' || v_order_number || ' is waiting for payment.',
    'proposal_accepted', coalesce(v_name, 'The specialist') || ' accepted your counter-offer',
    'Pay ' || public.format_money_minor(v_proposal.counter_price_minor, v_proposal.currency) || ' on Workido to start the work.',
    '/dashboard/orders/' || v_order::text || '/checkout');
  return v_order;
end;
$$;

create or replace function public.decline_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.chat_proposals := public.lock_proposal_for(p_proposal_id, 'buyer');
  v_name text;
begin
  if v_proposal.status not in ('pending', 'countered') then
    raise exception 'This proposal is already closed' using errcode = '23514';
  end if;
  update public.chat_proposals set status = 'declined', responded_at = now()
   where id = v_proposal.id returning * into v_proposal;
  select full_name into v_name from public.profiles where id = v_proposal.buyer_id;
  perform public.post_proposal_event(v_proposal, auth.uid(), 'Declined the proposal.',
    'proposal_declined', coalesce(v_name, 'The buyer') || ' declined your proposal', v_proposal.title);
end;
$$;

create or replace function public.withdraw_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.chat_proposals := public.lock_proposal_for(p_proposal_id, 'specialist');
  v_name text;
begin
  if v_proposal.status not in ('pending', 'countered') then
    raise exception 'This proposal is already closed' using errcode = '23514';
  end if;
  update public.chat_proposals set status = 'withdrawn', responded_at = now()
   where id = v_proposal.id returning * into v_proposal;
  select full_name into v_name from public.profiles where id = v_proposal.specialist_id;
  perform public.post_proposal_event(v_proposal, auth.uid(), 'Withdrew the proposal.',
    'proposal_withdrawn', coalesce(v_name, 'The specialist') || ' withdrew their proposal', v_proposal.title);
end;
$$;

-- Grants: helpers and internals are not callable from the API.
revoke execute on function public.format_money_minor(bigint, text) from public, anon;
revoke execute on function public.format_duration_hours(integer) from public, anon;
revoke execute on function public.mentions_contact_details(text) from public, anon;
-- Used by the messages trigger, which runs as the sender.
grant execute on function public.mentions_contact_details(text) to authenticated;
revoke execute on function public.create_order_from_proposal(public.chat_proposals, bigint, integer, uuid) from public, anon, authenticated;
revoke execute on function public.post_proposal_event(public.chat_proposals, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.lock_proposal_for(uuid, text) from public, anon, authenticated;
revoke execute on function public.send_proposal(uuid, text, text, text, bigint, integer, integer, uuid) from public, anon;
revoke execute on function public.accept_proposal(uuid) from public, anon;
revoke execute on function public.counter_proposal(uuid, bigint, integer, text) from public, anon;
revoke execute on function public.respond_to_counter(uuid, boolean) from public, anon;
revoke execute on function public.decline_proposal(uuid) from public, anon;
revoke execute on function public.withdraw_proposal(uuid) from public, anon;
grant execute on function public.send_proposal(uuid, text, text, text, bigint, integer, integer, uuid) to authenticated;
grant execute on function public.accept_proposal(uuid) to authenticated;
grant execute on function public.counter_proposal(uuid, bigint, integer, text) to authenticated;
grant execute on function public.respond_to_counter(uuid, boolean) to authenticated;
grant execute on function public.decline_proposal(uuid) to authenticated;
grant execute on function public.withdraw_proposal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: attachments in pre-order chats, voice notes everywhere
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('chat-files', 'chat-files', false, 25 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/zip',
          'text/plain', 'text/csv',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Voice notes recorded in the browser (Chrome: webm, Firefox: ogg, Safari: mp4).
update storage.buckets
   set allowed_mime_types = allowed_mime_types || array['audio/webm', 'audio/ogg', 'audio/mp4']
 where id = 'order-files' and not ('audio/webm' = any(allowed_mime_types));

create or replace function public.can_upload_chat_file(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_is_active() and exists (
    select 1 from public.conversations c
    join public.conversation_participants p on p.conversation_id = c.id and p.user_id = auth.uid()
    where c.id = p_conversation_id and c.kind = 'enquiry'
  );
$$;

revoke execute on function public.can_upload_chat_file(uuid) from public, anon;
grant execute on function public.can_upload_chat_file(uuid) to authenticated;

-- chat-files/<conversation_id>/<file>
create policy "chat_files_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-files'
         and (public.is_conversation_participant(public.try_uuid((storage.foldername(name))[1])) or public.is_admin()));

create policy "chat_files_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-files' and public.can_upload_chat_file(public.try_uuid((storage.foldername(name))[1])));

-- Uploads that never became a message (e.g. rejected by validation) can be removed by their uploader.
create policy "chat_files_delete_unsent" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-files'
    and owner_id = auth.uid()::text
    and not exists (select 1 from public.messages m where m.attachment_path = name)
  );
