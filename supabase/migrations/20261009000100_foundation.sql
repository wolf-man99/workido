-- =============================================================================
-- Workido foundation: enums, shared helpers, profiles, roles, private settings.
--
-- Conventions used across all migrations:
--   * UUID primary keys (gen_random_uuid()).
--   * Money is stored as integer minor units (e.g. paise) in *_minor columns,
--     always next to an explicit ISO-4217 currency code.
--   * Every exposed table has Row Level Security enabled.
--   * Privileged, multi-party state changes go through SECURITY DEFINER
--     functions that perform their own authorisation checks.
--   * Columns that ordinary users must never change (verification state,
--     cached reputation, moderation state) are protected by triggers that
--     reject changes made directly by the `authenticated`/`anon` roles.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('buyer', 'specialist', 'admin');
create type public.account_status as enum ('active', 'suspended');
create type public.verification_status as enum ('not_submitted', 'pending', 'verified', 'rejected');
create type public.availability_status as enum ('available', 'busy', 'unavailable');
create type public.experience_level as enum ('entry', 'intermediate', 'expert');
create type public.publication_status as enum ('draft', 'published', 'unpublished', 'removed');
create type public.requirement_status as enum ('draft', 'open', 'hired', 'closed');
create type public.urgency_level as enum ('flexible', 'standard', 'urgent');
create type public.invitation_status as enum ('invited', 'declined', 'offered');
create type public.offer_status as enum ('pending', 'accepted', 'declined', 'withdrawn');
create type public.order_status as enum (
  'pending_payment',
  'paid',
  'in_progress',
  'submitted',
  'revision_requested',
  'completed',
  'cancelled',
  'disputed',
  'refund_pending',
  'refunded'
);
create type public.payment_status as enum ('created', 'succeeded', 'failed', 'refunded');
create type public.refund_status as enum ('pending', 'processing', 'succeeded', 'failed');
create type public.payout_status as enum ('not_due', 'pending', 'paid_out', 'on_hold');
create type public.dispute_status as enum ('open', 'resolved');
create type public.dispute_outcome as enum ('complete_order', 'refund_buyer', 'resume_work');
create type public.message_type as enum ('text', 'file', 'system');
create type public.report_status as enum ('open', 'reviewed', 'dismissed');
create type public.report_target as enum ('message', 'user', 'service');
create type public.visibility as enum ('public', 'hidden');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Lowercase, hyphenated slug from arbitrary text.
create or replace function public.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- True when the current request is made directly by an end user through the
-- Data API (as opposed to a SECURITY DEFINER function, the service role, or a
-- migration). Used by column-protection triggers.
create or replace function public.is_direct_user_request()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('authenticated', 'anon');
$$;

-- ---------------------------------------------------------------------------
-- Profiles: public-facing identity. Never store email/phone here.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    constraint profiles_username_format check (username ~ '^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$'),
  full_name text not null
    constraint profiles_full_name_length check (char_length(trim(full_name)) between 1 and 100),
  avatar_path text,
  bio text constraint profiles_bio_length check (char_length(bio) <= 500),
  city text constraint profiles_city_length check (char_length(city) <= 80),
  region text constraint profiles_region_length check (char_length(region) <= 80),
  country_code text constraint profiles_country_code check (country_code ~ '^[A-Z]{2}$'),
  website_url text constraint profiles_website_url check (website_url ~* '^https?://' and char_length(website_url) <= 300),
  account_status public.account_status not null default 'active',
  -- Development sample profiles are flagged so the UI can label them honestly.
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Roles: a user can hold several capabilities (buyer and specialist).
-- Admin is only ever granted by a trusted process (SQL/service role).
-- ---------------------------------------------------------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  constraint user_roles_unique unique (user_id, role)
);

create index user_roles_role_idx on public.user_roles (role);

-- SECURITY DEFINER so policies on other tables can call it without
-- recursing into user_roles' own RLS.
create or replace function public.has_role(check_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = check_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin');
$$;

-- True when the caller is signed in and their account is not suspended.
create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and account_status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Private per-user settings (contact preferences). Owner-only.
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_notifications boolean not null default true,
  marketing_emails boolean not null default false,
  phone text constraint user_settings_phone check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  whatsapp_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Admin audit log: every privileged admin action is recorded here.
-- ---------------------------------------------------------------------------
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_actions_target_idx on public.admin_actions (target_type, target_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_settings enable row level security;
alter table public.admin_actions enable row level security;

-- Profiles are public identity cards; suspended accounts are hidden from the
-- public but remain visible to their owner and to admins.
create policy "profiles_select_public" on public.profiles
  for select using (account_status = 'active' or id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Users may see their own roles; admins may see everyone's.
create policy "user_roles_select_own" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Users may self-assign buyer/specialist capabilities but never admin.
create policy "user_roles_insert_self_non_admin" on public.user_roles
  for insert to authenticated
  with check (user_id = auth.uid() and role in ('buyer', 'specialist'));

create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using (user_id = auth.uid());

create policy "user_settings_update_own" on public.user_settings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admin_actions_select_admin" on public.admin_actions
  for select to authenticated using (public.is_admin());

-- Account status can only change through admin functions.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_direct_user_request() then
    if new.account_status is distinct from old.account_status then
      raise exception 'account_status can only be changed by an administrator'
        using errcode = '42501';
    end if;
    if new.is_sample is distinct from old.is_sample then
      raise exception 'is_sample cannot be changed' using errcode = '42501';
    end if;
    if new.id is distinct from old.id then
      raise exception 'id cannot be changed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();
