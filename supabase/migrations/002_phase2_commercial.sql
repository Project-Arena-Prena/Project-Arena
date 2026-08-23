-- Upgrade a Phase 1 Project Arena database to Phase 2.
-- Safe to re-run. For a fresh project, run supabase/schema.sql instead.

create extension if not exists pgcrypto;
create schema if not exists internal;
revoke all on schema internal from public;
revoke all on schema internal from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Convert arena_status enum → text
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'arenas' and column_name = 'status'
      and udt_name = 'arena_status'
  ) then
    alter table public.arenas alter column status drop default;
    alter table public.arenas alter column status type text using status::text;
  end if;
end $$;

update public.arenas set status = 'registration' where status = 'upcoming';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'arenas_status_check'
  ) then
    alter table public.arenas
      add constraint arenas_status_check
      check (status in ('draft', 'registration', 'full', 'live', 'finished', 'cancelled'));
  end if;
end $$;

alter table public.arenas alter column status set default 'draft';

-- ---------------------------------------------------------------------------
-- Arena columns
-- ---------------------------------------------------------------------------

alter table public.arenas add column if not exists category text not null default 'Open';
alter table public.arenas add column if not exists registration_opens_at timestamptz;
alter table public.arenas add column if not exists registration_closes_at timestamptz;
alter table public.arenas add column if not exists eligibility_text text not null default '';
alter table public.arenas add column if not exists scoring_config jsonb;
alter table public.arenas add column if not exists visibility text not null default 'public';
alter table public.arenas add column if not exists champion_project_id uuid references public.projects (id) on delete set null;
alter table public.arenas add column if not exists updated_at timestamptz not null default now();

update public.arenas
  set scoring_config = jsonb_build_object(
    'weights', jsonb_build_object('supporter', 1, 'uniqueVisit', 2),
    'rating', jsonb_build_object('champion', 100, 'top10', 70, 'top25', 40, 'top50', 15, 'bottom50', -10)
  )
  where scoring_config is null;

update public.arenas
  set registration_opens_at = coalesce(registration_opens_at, created_at),
      registration_closes_at = coalesce(registration_closes_at, starts_at)
  where registration_opens_at is null or registration_closes_at is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'arenas_visibility_check') then
    alter table public.arenas
      add constraint arenas_visibility_check
      check (visibility in ('public', 'unlisted'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

alter table public.projects add column if not exists updated_at timestamptz not null default now();
alter table public.projects alter column arena_rating set default 1000;

-- ---------------------------------------------------------------------------
-- Identity tables
-- ---------------------------------------------------------------------------

create table if not exists public.builders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null default '',
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_owners (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  builder_id uuid not null references public.builders (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  unique (project_id, builder_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  builder_id uuid not null references public.builders (id) on delete restrict,
  project_id uuid not null references public.projects (id) on delete restrict,
  arena_id uuid not null references public.arenas (id) on delete restrict,
  provider text not null default 'stripe',
  provider_checkout_id text unique,
  provider_payment_id text unique,
  amount integer not null check (amount >= 0),
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled', 'overflow')),
  receipt_url text,
  refund_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  refunded_at timestamptz
);

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Entries: expand statuses
-- ---------------------------------------------------------------------------

alter table public.arena_entries add column if not exists builder_id uuid references public.builders (id) on delete set null;
alter table public.arena_entries add column if not exists payment_id uuid references public.payments (id) on delete set null;
alter table public.arena_entries add column if not exists current_rank integer;
alter table public.arena_entries add column if not exists impression_count integer not null default 0;
alter table public.arena_entries add column if not exists rejection_reason text;
alter table public.arena_entries add column if not exists approved_at timestamptz;
alter table public.arena_entries add column if not exists rejected_at timestamptz;
alter table public.arena_entries add column if not exists created_at timestamptz not null default now();
alter table public.arena_entries add column if not exists updated_at timestamptz not null default now();

alter table public.arena_entries drop constraint if exists arena_entries_status_check;
alter table public.arena_entries drop constraint if exists arena_entries_arena_id_project_id_key;

update public.arena_entries ae
set status = case
  when a.status = 'live' and ae.status in ('confirmed', 'pending') then 'competing'
  when a.status = 'finished' and ae.status in ('confirmed', 'pending') then 'finished'
  when a.status in ('upcoming', 'registration', 'full') and ae.status in ('confirmed', 'pending') then 'approved'
  when ae.status = 'disqualified' then 'disqualified'
  else ae.status
end
from public.arenas a
where a.id = ae.arena_id
  and ae.status in ('confirmed', 'pending', 'disqualified');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'arena_entries_status_check') then
    alter table public.arena_entries
      add constraint arena_entries_status_check
      check (status in (
        'pending_payment', 'pending_review', 'approved', 'rejected',
        'withdrawn', 'competing', 'finished', 'disqualified'
      ));
  end if;
end $$;

create unique index if not exists arena_entries_active_unique
  on public.arena_entries (arena_id, project_id)
  where status in ('pending_payment', 'pending_review', 'approved', 'competing');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'arena_entries_arena_id_project_id_key'
  ) then
    alter table public.arena_entries
      add constraint arena_entries_arena_id_project_id_key unique (arena_id, project_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Event integrity columns
-- ---------------------------------------------------------------------------

alter table public.supports add column if not exists is_valid boolean not null default true;
alter table public.supports add column if not exists fraud_score integer not null default 0;
alter table public.supports add column if not exists invalid_reason text;
alter table public.supports add column if not exists ip_hash text;
alter table public.supports add column if not exists ua_hash text;
alter table public.supports add column if not exists session_id text;

alter table public.outbound_visits add column if not exists is_valid boolean not null default true;
alter table public.outbound_visits add column if not exists fraud_score integer not null default 0;
alter table public.outbound_visits add column if not exists invalid_reason text;
alter table public.outbound_visits add column if not exists ip_hash text;
alter table public.outbound_visits add column if not exists ua_hash text;
alter table public.outbound_visits add column if not exists session_id text;

create table if not exists public.project_impressions (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid references public.arenas (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  event_type text not null,
  event_id uuid,
  reason text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'reviewed', 'ignored', 'confirmed')),
  created_at timestamptz not null default now()
);

create table if not exists public.arena_rating_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  arena_id uuid not null references public.arenas (id) on delete cascade,
  rating_before integer not null,
  rating_change integer not null,
  rating_after integer not null,
  created_at timestamptz not null default now(),
  unique (project_id, arena_id)
);

create table if not exists public.rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  rank integer not null,
  score integer not null,
  label text not null default 'live',
  captured_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  visitor_id uuid,
  builder_id uuid references public.builders (id) on delete set null,
  arena_id uuid references public.arenas (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  template text not null,
  to_email text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'mocked')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists project_owners_builder_idx on public.project_owners (builder_id);
create index if not exists payments_builder_idx on public.payments (builder_id, created_at desc);
create index if not exists payments_arena_idx on public.payments (arena_id, status);
create index if not exists arena_entries_builder_idx on public.arena_entries (builder_id);
create index if not exists arena_entries_status_idx on public.arena_entries (arena_id, status);
create index if not exists fraud_flags_status_idx on public.fraud_flags (status, created_at desc);
create index if not exists project_impressions_lookup_idx
  on public.project_impressions (arena_id, project_id, visitor_id, created_at desc);
create index if not exists rank_snapshots_entry_idx
  on public.rank_snapshots (arena_id, project_id, captured_at);
create index if not exists analytics_events_name_idx on public.analytics_events (name, created_at desc);
create index if not exists arenas_status_starts_idx on public.arenas (status, starts_at);

-- Recreate functions and policies from the canonical schema.
-- Operators should run supabase/schema.sql after this migration on a copy,
-- or paste the function/view/RLS sections. The canonical file is idempotent
-- for function replacement (`create or replace`) and policy drops.
