-- =============================================================================
-- Conversation inbox, email notification outbox, and the public contact form.
-- =============================================================================

-- Inbox for the signed-in user with last message and unread count.
-- SECURITY INVOKER: RLS limits rows to the caller's own conversations.
create or replace function public.list_my_conversations()
returns table (
  conversation_id uuid,
  order_id uuid,
  order_title text,
  order_number text,
  order_status public.order_status,
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
    c.id, o.id, o.title, o.order_number, o.status,
    other.id, other.full_name, other.username, other.avatar_path,
    c.last_message_at,
    last_message.body, last_message.message_type, last_message.sender_id,
    (select count(*) from public.messages m
      where m.conversation_id = c.id
        and m.sender_id is distinct from auth.uid()
        and (me.last_read_at is null or m.created_at > me.last_read_at))
  from public.conversation_participants me
  join public.conversations c on c.id = me.conversation_id
  join public.orders o on o.id = c.order_id
  join public.profiles other on other.id = case when o.buyer_id = auth.uid() then o.specialist_id else o.buyer_id end
  left join lateral (
    select m.body, m.message_type, m.sender_id from public.messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) last_message on true
  where me.user_id = auth.uid()
  order by coalesce(c.last_message_at, c.created_at) desc
  limit 100;
$$;

revoke execute on function public.list_my_conversations() from public, anon;
grant execute on function public.list_my_conversations() to authenticated;

-- Email outbox for the dispatcher (/api/notifications/dispatch). Returns the
-- recipient's email only to the service role, never to API users.
create or replace function public.notification_email_outbox(p_limit integer default 50)
returns table (
  notification_id uuid,
  user_id uuid,
  email text,
  full_name text,
  email_enabled boolean,
  type text,
  title text,
  body text,
  link_path text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.user_id, u.email::text, p.full_name, coalesce(s.email_notifications, false),
         n.type, n.title, n.body, n.link_path, n.created_at
  from public.notifications n
  join auth.users u on u.id = n.user_id
  join public.profiles p on p.id = n.user_id
  left join public.user_settings s on s.user_id = n.user_id
  where n.emailed_at is null
    and n.created_at > now() - interval '2 days'
  order by n.created_at
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke execute on function public.notification_email_outbox(integer) from public, anon, authenticated;
grant execute on function public.notification_email_outbox(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Contact form messages (support inbox for admins)
-- ---------------------------------------------------------------------------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  name text not null constraint contact_messages_name check (char_length(trim(name)) between 2 and 100),
  email text not null constraint contact_messages_email check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  topic text not null constraint contact_messages_topic check (topic in ('general', 'buying', 'selling', 'payments', 'trust_safety', 'other')),
  message text not null constraint contact_messages_message check (char_length(trim(message)) between 10 and 4000),
  status text not null default 'open' constraint contact_messages_status check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create index contact_messages_status_idx on public.contact_messages (status, created_at desc);
create index contact_messages_email_idx on public.contact_messages (lower(email), created_at desc);

-- Simple abuse protection: at most 5 messages per email address per hour.
create or replace function public.contact_messages_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.contact_messages
      where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many messages. Please try again later.' using errcode = '23514';
  end if;
  new.status := 'open';
  new.created_at := now();
  return new;
end;
$$;

create trigger contact_messages_rate_limit
  before insert on public.contact_messages
  for each row execute function public.contact_messages_rate_limit();

alter table public.contact_messages enable row level security;

create policy "contact_messages_insert" on public.contact_messages
  for insert with check (user_id is null or user_id = auth.uid());
create policy "contact_messages_select_admin" on public.contact_messages
  for select to authenticated using (public.is_admin());
create policy "contact_messages_update_admin" on public.contact_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke update, delete on public.contact_messages from anon;
