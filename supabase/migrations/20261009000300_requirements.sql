-- =============================================================================
-- Mode B: custom requirements, matching shortlist, invitations and offers.
--
-- Flow: buyer posts requirement -> deterministic matching shortlist
-- (requirement_matches, buyer-only) -> buyer invites specialists
-- (requirement_invitations) -> invited specialists submit offers -> buyer
-- accepts one offer (accept_offer() in the orders migration) -> order.
-- There is deliberately no open/public bidding.
-- =============================================================================

create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid references public.categories (id) on delete restrict,
  subcategory_id uuid references public.categories (id) on delete set null,
  title text not null constraint requirements_title_length check (char_length(trim(title)) between 3 and 120),
  description text not null default '' constraint requirements_description_length check (char_length(description) <= 5000),
  deliverables text constraint requirements_deliverables_length check (char_length(deliverables) <= 2000),
  quantity integer constraint requirements_quantity_range check (quantity between 1 and 1000),
  revisions_expected smallint constraint requirements_revisions_range check (revisions_expected between 0 and 10),
  reference_links text[] not null default '{}'
    constraint requirements_reference_links_count check (cardinality(reference_links) <= 10),
  budget_min_minor bigint constraint requirements_budget_min check (budget_min_minor >= 0),
  budget_max_minor bigint constraint requirements_budget_max check (budget_max_minor > 0),
  currency text not null default 'INR' constraint requirements_currency check (currency ~ '^[A-Z]{3}$'),
  deadline_at timestamptz,
  urgency public.urgency_level not null default 'standard',
  preferred_experience public.experience_level,
  location_preference text constraint requirements_location_length check (char_length(location_preference) <= 100),
  remote_ok boolean not null default true,
  status public.requirement_status not null default 'draft',
  submitted_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requirements_budget_order check (
    budget_min_minor is null or budget_max_minor is null or budget_min_minor <= budget_max_minor
  ),
  -- Drafts may be incomplete; anything beyond draft must be fully specified.
  constraint requirements_complete_when_submitted check (
    status = 'draft' or (
      category_id is not null
      and char_length(trim(title)) >= 8
      and char_length(trim(description)) >= 30
      and budget_max_minor is not null
    )
  )
);

create index requirements_buyer_idx on public.requirements (buyer_id, status);
create index requirements_category_idx on public.requirements (category_id, status);

create trigger requirements_set_updated_at
  before update on public.requirements
  for each row execute function public.set_updated_at();

create or replace function public.requirements_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_direct_user_request() then
    -- "hired" is only reachable through accept_offer().
    if new.status = 'hired' and (tg_op = 'INSERT' or old.status is distinct from 'hired') then
      raise exception 'A requirement becomes hired only when an offer is accepted' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' then
      if old.status in ('hired', 'closed') then
        raise exception 'This requirement can no longer be edited' using errcode = '42501';
      end if;
      if old.status = 'open' and new.status = 'draft' then
        raise exception 'A submitted requirement cannot return to draft' using errcode = '23514';
      end if;
      if new.buyer_id is distinct from old.buyer_id then
        raise exception 'buyer_id cannot be changed' using errcode = '42501';
      end if;
    end if;
  end if;

  if new.status = 'open' and (tg_op = 'INSERT' or old.status = 'draft') then
    new.submitted_at := now();
  end if;
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status is distinct from 'closed') then
    new.closed_at := now();
  end if;
  return new;
end;
$$;

create trigger requirements_before_write
  before insert or update on public.requirements
  for each row execute function public.requirements_before_write();

create table public.requirement_skills (
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  -- Mandatory skills exclude specialists who lack them (see matching engine).
  is_mandatory boolean not null default false,
  primary key (requirement_id, skill_id)
);

create index requirement_skills_skill_idx on public.requirement_skills (skill_id);

create table public.requirement_attachments (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  storage_path text not null unique,
  filename text not null constraint requirement_attachments_filename check (char_length(filename) between 1 and 255),
  content_type text not null,
  size_bytes bigint not null constraint requirement_attachments_size check (size_bytes > 0),
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index requirement_attachments_requirement_idx on public.requirement_attachments (requirement_id);

-- Private shortlist produced by the deterministic matching engine. Scores
-- and reasons are visible to the requirement owner only.
create table public.requirement_matches (
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  specialist_id uuid not null references public.specialist_profiles (user_id) on delete cascade,
  score numeric(5, 2) not null constraint requirement_matches_score check (score between 0 and 100),
  rank integer not null,
  reasons text[] not null default '{}',
  computed_at timestamptz not null default now(),
  primary key (requirement_id, specialist_id)
);

create table public.requirement_invitations (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  specialist_id uuid not null references public.specialist_profiles (user_id) on delete cascade,
  status public.invitation_status not null default 'invited',
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint requirement_invitations_unique unique (requirement_id, specialist_id)
);

create index requirement_invitations_specialist_idx on public.requirement_invitations (specialist_id, status);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  specialist_id uuid not null references public.specialist_profiles (user_id) on delete cascade,
  proposed_price_minor bigint not null constraint offers_price_range check (proposed_price_minor between 10000 and 100000000),
  currency text not null default 'INR' constraint offers_currency check (currency ~ '^[A-Z]{3}$'),
  delivery_time_hours integer not null constraint offers_delivery_range check (delivery_time_hours between 1 and 2160),
  revisions_included smallint not null default 1 constraint offers_revisions_range check (revisions_included between 0 and 10),
  message text not null constraint offers_message_length check (char_length(trim(message)) between 20 and 2000),
  status public.offer_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live offer per specialist per requirement, one accepted offer per requirement.
create unique index offers_one_pending_per_specialist
  on public.offers (requirement_id, specialist_id) where status = 'pending';
create unique index offers_one_accepted_per_requirement
  on public.offers (requirement_id) where status = 'accepted';
create index offers_specialist_idx on public.offers (specialist_id, status);

create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
create or replace function public.owns_requirement(req uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.requirements where id = req and buyer_id = auth.uid());
$$;

create or replace function public.is_invited_to_requirement(req uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.requirement_invitations
    where requirement_id = req and specialist_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Invitation rules
-- ---------------------------------------------------------------------------
create or replace function public.requirement_invitations_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  req public.requirements;
  invite_count integer;
begin
  if tg_op = 'INSERT' then
    select * into req from public.requirements where id = new.requirement_id;
    if req.status <> 'open' then
      raise exception 'Specialists can only be invited to open requirements' using errcode = '23514';
    end if;
    if new.specialist_id = req.buyer_id then
      raise exception 'You cannot invite yourself' using errcode = '23514';
    end if;
    if not public.is_public_specialist(new.specialist_id) then
      raise exception 'This specialist is not currently accepting invitations' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.specialist_profiles
      where user_id = new.specialist_id and availability_status = 'unavailable'
    ) then
      raise exception 'This specialist is currently unavailable' using errcode = '23514';
    end if;
    -- Keep shortlists small: quality over quantity.
    select count(*) into invite_count from public.requirement_invitations where requirement_id = new.requirement_id;
    if invite_count >= 10 then
      raise exception 'A requirement can have at most 10 invitations' using errcode = '23514';
    end if;
    new.status := 'invited';
    new.responded_at := null;
  elsif public.is_direct_user_request() then
    if new.requirement_id is distinct from old.requirement_id
       or new.specialist_id is distinct from old.specialist_id then
      raise exception 'Invitation parties cannot be changed' using errcode = '42501';
    end if;
    -- Specialists may only decline directly; "offered" is set by offer creation.
    if new.status is distinct from old.status then
      if not (old.status = 'invited' and new.status = 'declined') then
        raise exception 'Invalid invitation status change' using errcode = '42501';
      end if;
      new.responded_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger requirement_invitations_before_write
  before insert or update on public.requirement_invitations
  for each row execute function public.requirement_invitations_before_write();

-- ---------------------------------------------------------------------------
-- Offer rules
-- ---------------------------------------------------------------------------
create or replace function public.offers_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  req public.requirements;
begin
  if tg_op = 'INSERT' then
    select * into req from public.requirements where id = new.requirement_id;
    if req.status <> 'open' then
      raise exception 'This requirement is no longer accepting offers' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.requirement_invitations
      where requirement_id = new.requirement_id
        and specialist_id = new.specialist_id
        and status in ('invited', 'offered')
    ) then
      raise exception 'Only invited specialists can submit offers' using errcode = '42501';
    end if;
    if new.currency <> req.currency then
      raise exception 'Offer currency must match the requirement currency' using errcode = '23514';
    end if;
    new.status := 'pending';
    new.responded_at := null;
  elsif public.is_direct_user_request() then
    if new.requirement_id is distinct from old.requirement_id
       or new.specialist_id is distinct from old.specialist_id
       or new.currency is distinct from old.currency then
      raise exception 'Offer parties and currency cannot be changed' using errcode = '42501';
    end if;
    if old.status <> 'pending' then
      raise exception 'Only pending offers can be changed' using errcode = '23514';
    end if;
    -- Direct user updates may edit a pending offer or withdraw it. Accepting
    -- and declining happen through accept_offer()/decline_offer().
    if new.status not in ('pending', 'withdrawn') then
      raise exception 'Invalid offer status change' using errcode = '42501';
    end if;
    if new.status = 'withdrawn' then
      new.responded_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger offers_before_write
  before insert or update on public.offers
  for each row execute function public.offers_before_write();

create or replace function public.offers_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.requirement_invitations
     set status = 'offered', responded_at = now()
   where requirement_id = new.requirement_id and specialist_id = new.specialist_id;
  return new;
end;
$$;

create trigger offers_after_insert
  after insert on public.offers
  for each row execute function public.offers_after_insert();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.requirements enable row level security;
alter table public.requirement_skills enable row level security;
alter table public.requirement_attachments enable row level security;
alter table public.requirement_matches enable row level security;
alter table public.requirement_invitations enable row level security;
alter table public.offers enable row level security;

-- Requirements are private: owner, invited specialists and admins only.
create policy "requirements_select" on public.requirements
  for select to authenticated
  using (buyer_id = auth.uid() or public.is_invited_to_requirement(id) or public.is_admin());
create policy "requirements_insert_own" on public.requirements
  for insert to authenticated
  with check (buyer_id = auth.uid() and status in ('draft', 'open') and public.current_user_is_active());
create policy "requirements_update_own" on public.requirements
  for update to authenticated
  using (buyer_id = auth.uid())
  with check (buyer_id = auth.uid() and status in ('draft', 'open', 'closed'));
create policy "requirements_delete_own_draft" on public.requirements
  for delete to authenticated using (buyer_id = auth.uid() and status = 'draft');

create policy "requirement_skills_select" on public.requirement_skills
  for select to authenticated
  using (public.owns_requirement(requirement_id) or public.is_invited_to_requirement(requirement_id) or public.is_admin());
create policy "requirement_skills_insert_own" on public.requirement_skills
  for insert to authenticated with check (public.owns_requirement(requirement_id));
create policy "requirement_skills_update_own" on public.requirement_skills
  for update to authenticated using (public.owns_requirement(requirement_id)) with check (public.owns_requirement(requirement_id));
create policy "requirement_skills_delete_own" on public.requirement_skills
  for delete to authenticated using (public.owns_requirement(requirement_id));

create policy "requirement_attachments_select" on public.requirement_attachments
  for select to authenticated
  using (public.owns_requirement(requirement_id) or public.is_invited_to_requirement(requirement_id) or public.is_admin());
create policy "requirement_attachments_insert_own" on public.requirement_attachments
  for insert to authenticated
  with check (public.owns_requirement(requirement_id) and uploaded_by = auth.uid());
create policy "requirement_attachments_delete_own" on public.requirement_attachments
  for delete to authenticated using (public.owns_requirement(requirement_id));

create policy "requirement_matches_select_owner" on public.requirement_matches
  for select to authenticated using (public.owns_requirement(requirement_id) or public.is_admin());
create policy "requirement_matches_insert_owner" on public.requirement_matches
  for insert to authenticated with check (public.owns_requirement(requirement_id));
create policy "requirement_matches_update_owner" on public.requirement_matches
  for update to authenticated using (public.owns_requirement(requirement_id)) with check (public.owns_requirement(requirement_id));
create policy "requirement_matches_delete_owner" on public.requirement_matches
  for delete to authenticated using (public.owns_requirement(requirement_id));

create policy "invitations_select" on public.requirement_invitations
  for select to authenticated
  using (specialist_id = auth.uid() or public.owns_requirement(requirement_id) or public.is_admin());
create policy "invitations_insert_owner" on public.requirement_invitations
  for insert to authenticated
  with check (public.owns_requirement(requirement_id) and public.current_user_is_active());
create policy "invitations_update_specialist" on public.requirement_invitations
  for update to authenticated
  using (specialist_id = auth.uid())
  with check (specialist_id = auth.uid());

create policy "offers_select" on public.offers
  for select to authenticated
  using (specialist_id = auth.uid() or public.owns_requirement(requirement_id) or public.is_admin());
create policy "offers_insert_specialist" on public.offers
  for insert to authenticated
  with check (
    specialist_id = auth.uid()
    and public.current_user_is_active()
    and public.is_public_specialist(auth.uid())
  );
create policy "offers_update_specialist" on public.offers
  for update to authenticated
  using (specialist_id = auth.uid())
  with check (specialist_id = auth.uid());
