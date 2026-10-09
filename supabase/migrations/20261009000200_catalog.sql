-- =============================================================================
-- Marketplace catalogue: categories, skills, specialist profiles, portfolio,
-- service listings and verification requests.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Categories (hierarchical, admin-managed). Not limited to marketing.
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint categories_name_length check (char_length(name) between 2 and 60),
  slug text not null unique constraint categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text constraint categories_description_length check (char_length(description) <= 300),
  -- Name of a Lucide icon rendered by the UI (e.g. "palette").
  icon text constraint categories_icon_format check (icon ~ '^[a-z0-9-]{1,40}$'),
  parent_id uuid references public.categories (id) on delete restrict,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_not_own_parent check (parent_id is distinct from id)
);

create index categories_parent_idx on public.categories (parent_id);
create index categories_active_sort_idx on public.categories (is_active, sort_order);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Skills
-- ---------------------------------------------------------------------------
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint skills_name_length check (char_length(name) between 2 and 60),
  slug text not null unique constraint skills_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category_id uuid references public.categories (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index skills_category_idx on public.skills (category_id);

-- ---------------------------------------------------------------------------
-- Specialist profiles (1:1 with profiles for users holding the role).
-- ---------------------------------------------------------------------------
create table public.specialist_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  headline text constraint specialist_headline_length check (char_length(headline) <= 120),
  professional_bio text constraint specialist_bio_length check (char_length(professional_bio) <= 3000),
  experience_level public.experience_level,
  years_experience smallint constraint specialist_years check (years_experience between 0 and 60),
  availability_status public.availability_status not null default 'available',
  is_published boolean not null default false,
  published_at timestamptz,
  -- Public verification state. Only changed by admin review functions.
  verification_status public.verification_status not null default 'not_submitted',
  -- Cached aggregates maintained by triggers on reviews and orders (see
  -- 20261009000600_reviews_notifications.sql). Never user-editable.
  rating_avg numeric(3, 2),
  rating_count integer not null default 0,
  completed_orders_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index specialist_profiles_discovery_idx
  on public.specialist_profiles (is_published, availability_status);

create trigger specialist_profiles_set_updated_at
  before update on public.specialist_profiles
  for each row execute function public.set_updated_at();

create table public.specialist_skills (
  specialist_id uuid not null references public.specialist_profiles (user_id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  years_experience smallint constraint specialist_skills_years check (years_experience between 0 and 60),
  created_at timestamptz not null default now(),
  primary key (specialist_id, skill_id)
);

create index specialist_skills_skill_idx on public.specialist_skills (skill_id);

create table public.specialist_categories (
  specialist_id uuid not null references public.specialist_profiles (user_id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (specialist_id, category_id)
);

create index specialist_categories_category_idx on public.specialist_categories (category_id);

-- ---------------------------------------------------------------------------
-- Portfolio
-- ---------------------------------------------------------------------------
create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  specialist_id uuid not null references public.specialist_profiles (user_id) on delete cascade,
  title text not null constraint portfolio_title_length check (char_length(title) between 2 and 100),
  description text constraint portfolio_description_length check (char_length(description) <= 1000),
  category_id uuid references public.categories (id) on delete set null,
  -- Object path inside the public "portfolio" bucket ("<user_id>/<file>").
  asset_path text,
  external_url text constraint portfolio_external_url check (external_url ~* '^https?://' and char_length(external_url) <= 500),
  visibility public.visibility not null default 'public',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint portfolio_has_evidence check (asset_path is not null or external_url is not null)
);

create index portfolio_items_specialist_idx on public.portfolio_items (specialist_id, visibility);
create index portfolio_items_category_idx on public.portfolio_items (category_id);

-- ---------------------------------------------------------------------------
-- Service listings (Mode A: predefined gigs)
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  specialist_id uuid not null references public.specialist_profiles (user_id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null constraint services_title_length check (char_length(title) between 8 and 100),
  -- Generated from the title by services_before_write() when left empty.
  slug text not null default '' unique constraint services_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null constraint services_description_length check (char_length(description) between 30 and 5000),
  deliverables text not null constraint services_deliverables_length check (char_length(deliverables) between 5 and 2000),
  -- What the buyer must provide when ordering ("Additional requirements from buyers").
  buyer_instructions text constraint services_instructions_length check (char_length(buyer_instructions) <= 2000),
  price_minor bigint not null constraint services_price_range check (price_minor between 10000 and 100000000),
  currency text not null default 'INR' constraint services_currency check (currency ~ '^[A-Z]{3}$'),
  delivery_time_hours integer not null constraint services_delivery_range check (delivery_time_hours between 1 and 2160),
  included_revisions smallint not null default 1 constraint services_revisions_range check (included_revisions between 0 and 10),
  publication_status public.publication_status not null default 'draft',
  -- Reason recorded when an admin removes a listing. Visible to owner/admin only
  -- because removed listings are not publicly readable.
  moderation_note text constraint services_moderation_note_length check (char_length(moderation_note) <= 500),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_specialist_idx on public.services (specialist_id);
create index services_discovery_idx on public.services (publication_status, category_id, price_minor);
create index services_delivery_idx on public.services (delivery_time_hours);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- Generates a unique slug when none is supplied and maintains published_at.
create or replace function public.services_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (new.slug is null or new.slug = '') then
    new.slug := left(public.slugify(new.title), 80) || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  end if;

  if new.publication_status = 'published'
     and (tg_op = 'INSERT' or old.publication_status is distinct from 'published') then
    new.published_at := now();
  end if;

  if public.is_direct_user_request() then
    -- Owners cannot remove, or undo removal of, a listing; that is moderation.
    if new.publication_status = 'removed'
       and (tg_op = 'INSERT' or old.publication_status is distinct from 'removed') then
      raise exception 'Only administrators can remove listings' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and old.publication_status = 'removed'
       and new.publication_status is distinct from 'removed' then
      raise exception 'This listing was removed by moderation and cannot be republished'
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.moderation_note is distinct from old.moderation_note then
      raise exception 'moderation_note can only be set by administrators' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.specialist_id is distinct from old.specialist_id then
      raise exception 'specialist_id cannot be changed' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger services_before_write
  before insert or update on public.services
  for each row execute function public.services_before_write();

-- ---------------------------------------------------------------------------
-- Verification requests (admin-reviewed). The public state is mirrored onto
-- specialist_profiles.verification_status by the admin review function.
-- ---------------------------------------------------------------------------
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  specialist_id uuid not null references public.specialist_profiles (user_id) on delete cascade,
  status public.verification_status not null default 'pending'
    constraint verification_requests_status check (status in ('pending', 'verified', 'rejected')),
  message text constraint verification_message_length check (char_length(message) <= 1000),
  decision_note text constraint verification_decision_length check (char_length(decision_note) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index verification_requests_one_pending
  on public.verification_requests (specialist_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Column protection and publication rules for specialist profiles
-- ---------------------------------------------------------------------------
create or replace function public.specialist_profiles_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  skill_count integer;
begin
  if public.is_direct_user_request() then
    if new.verification_status is distinct from old.verification_status then
      raise exception 'Verification status can only be changed through admin review'
        using errcode = '42501';
    end if;
    if new.rating_avg is distinct from old.rating_avg
       or new.rating_count is distinct from old.rating_count
       or new.completed_orders_count is distinct from old.completed_orders_count then
      raise exception 'Reputation metrics are derived from completed orders and cannot be edited'
        using errcode = '42501';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id cannot be changed' using errcode = '42501';
    end if;
  end if;

  -- Publication requires a minimally complete profile.
  if new.is_published and not old.is_published then
    select count(*) into skill_count from public.specialist_skills where specialist_id = new.user_id;
    if coalesce(char_length(trim(new.headline)), 0) < 10 then
      raise exception 'Add a headline of at least 10 characters before publishing' using errcode = '23514';
    end if;
    if coalesce(char_length(trim(new.professional_bio)), 0) < 50 then
      raise exception 'Add a professional bio of at least 50 characters before publishing' using errcode = '23514';
    end if;
    if new.experience_level is null then
      raise exception 'Select your experience level before publishing' using errcode = '23514';
    end if;
    if skill_count = 0 then
      raise exception 'Add at least one skill before publishing' using errcode = '23514';
    end if;
    new.published_at := now();
  end if;

  return new;
end;
$$;

create trigger specialist_profiles_before_update
  before update on public.specialist_profiles
  for each row execute function public.specialist_profiles_before_update();

-- A specialist profile is publicly discoverable when published and the
-- underlying account is active.
create or replace function public.is_public_specialist(specialist uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.specialist_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.user_id = specialist and sp.is_published and p.account_status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- New-user bootstrap: profile, private settings, initial role.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
  initial_role text;
  base_username text;
  candidate text;
  attempts integer := 0;
begin
  display_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), 'Workido user'), 100);
  initial_role := new.raw_user_meta_data ->> 'initial_role';

  base_username := left(regexp_replace(lower(display_name), '[^a-z0-9]+', '', 'g'), 20);
  if char_length(base_username) < 3 then
    base_username := 'user' || base_username;
  end if;
  candidate := base_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    attempts := attempts + 1;
    candidate := base_username || (floor(random() * 90000) + 10000)::int::text;
    if attempts > 20 then
      candidate := 'user' || substr(replace(new.id::text, '-', ''), 1, 12);
      exit;
    end if;
  end loop;

  insert into public.profiles (id, username, full_name) values (new.id, candidate, display_name);
  insert into public.user_settings (user_id) values (new.id);

  -- Only buyer/specialist may be requested at sign-up; anything else
  -- (including "admin") falls back to buyer.
  if initial_role = 'specialist' then
    insert into public.user_roles (user_id, role) values (new.id, 'specialist');
    insert into public.specialist_profiles (user_id) values (new.id);
  else
    insert into public.user_roles (user_id, role) values (new.id, 'buyer');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets an existing user enable the specialist capability later.
create or replace function public.become_specialist()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.current_user_is_active() then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'specialist')
    on conflict (user_id, role) do nothing;
  insert into public.specialist_profiles (user_id) values (auth.uid())
    on conflict (user_id) do nothing;
end;
$$;

-- Specialists ask for verification once their profile is published.
create or replace function public.submit_verification_request(p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sp public.specialist_profiles;
  v_request_id uuid;
begin
  select * into v_sp from public.specialist_profiles where user_id = auth.uid() for update;
  if not found then
    raise exception 'Create a specialist profile first' using errcode = '42501';
  end if;
  if not public.current_user_is_active() then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;
  if not v_sp.is_published then
    raise exception 'Publish your profile before requesting verification' using errcode = '23514';
  end if;
  if v_sp.verification_status in ('pending', 'verified') then
    raise exception 'Verification is already %', v_sp.verification_status using errcode = '23514';
  end if;
  if not exists (select 1 from public.portfolio_items where specialist_id = auth.uid()) then
    raise exception 'Add at least one portfolio item before requesting verification' using errcode = '23514';
  end if;

  insert into public.verification_requests (specialist_id, message)
    values (auth.uid(), left(p_note, 1000))
    returning id into v_request_id;

  update public.specialist_profiles set verification_status = 'pending' where user_id = auth.uid();
  return v_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.skills enable row level security;
alter table public.specialist_profiles enable row level security;
alter table public.specialist_skills enable row level security;
alter table public.specialist_categories enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.services enable row level security;
alter table public.verification_requests enable row level security;

-- Categories & skills: public read of active rows, admin write.
create policy "categories_select" on public.categories
  for select using (is_active or public.is_admin());
create policy "categories_admin_insert" on public.categories
  for insert to authenticated with check (public.is_admin());
create policy "categories_admin_update" on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "categories_admin_delete" on public.categories
  for delete to authenticated using (public.is_admin());

create policy "skills_select" on public.skills
  for select using (is_active or public.is_admin());
create policy "skills_admin_insert" on public.skills
  for insert to authenticated with check (public.is_admin());
create policy "skills_admin_update" on public.skills
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "skills_admin_delete" on public.skills
  for delete to authenticated using (public.is_admin());

-- Specialist profiles: public when published; always visible to owner/admin.
create policy "specialist_profiles_select" on public.specialist_profiles
  for select using (public.is_public_specialist(user_id) or user_id = auth.uid() or public.is_admin());
create policy "specialist_profiles_update_own" on public.specialist_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "specialist_skills_select" on public.specialist_skills
  for select using (public.is_public_specialist(specialist_id) or specialist_id = auth.uid() or public.is_admin());
create policy "specialist_skills_insert_own" on public.specialist_skills
  for insert to authenticated with check (specialist_id = auth.uid());
create policy "specialist_skills_update_own" on public.specialist_skills
  for update to authenticated using (specialist_id = auth.uid()) with check (specialist_id = auth.uid());
create policy "specialist_skills_delete_own" on public.specialist_skills
  for delete to authenticated using (specialist_id = auth.uid());

create policy "specialist_categories_select" on public.specialist_categories
  for select using (public.is_public_specialist(specialist_id) or specialist_id = auth.uid() or public.is_admin());
create policy "specialist_categories_insert_own" on public.specialist_categories
  for insert to authenticated with check (specialist_id = auth.uid());
create policy "specialist_categories_delete_own" on public.specialist_categories
  for delete to authenticated using (specialist_id = auth.uid());

create policy "portfolio_select" on public.portfolio_items
  for select using (
    (visibility = 'public' and public.is_public_specialist(specialist_id))
    or specialist_id = auth.uid()
    or public.is_admin()
  );
create policy "portfolio_insert_own" on public.portfolio_items
  for insert to authenticated with check (specialist_id = auth.uid());
create policy "portfolio_update_own" on public.portfolio_items
  for update to authenticated using (specialist_id = auth.uid()) with check (specialist_id = auth.uid());
create policy "portfolio_delete_own" on public.portfolio_items
  for delete to authenticated using (specialist_id = auth.uid());

-- Services: published listings of public specialists are public.
create policy "services_select" on public.services
  for select using (
    (publication_status = 'published' and public.is_public_specialist(specialist_id))
    or specialist_id = auth.uid()
    or public.is_admin()
  );
create policy "services_insert_own" on public.services
  for insert to authenticated
  with check (specialist_id = auth.uid() and public.has_role('specialist') and public.current_user_is_active());
create policy "services_update_own" on public.services
  for update to authenticated
  using (specialist_id = auth.uid())
  with check (specialist_id = auth.uid());
-- Deleting is only allowed for listings that were never ordered; the orders
-- foreign key (ON DELETE RESTRICT) enforces that.
create policy "services_delete_own" on public.services
  for delete to authenticated using (specialist_id = auth.uid() and publication_status <> 'removed');

create policy "verification_requests_select" on public.verification_requests
  for select to authenticated using (specialist_id = auth.uid() or public.is_admin());
