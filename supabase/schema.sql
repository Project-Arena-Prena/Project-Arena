-- Project Arena — Phase 2 production schema.
-- Run on a fresh Supabase project, then run supabase/seed.sql.
-- Existing Phase 1 databases should run supabase/migrations/002_phase2_commercial.sql instead.

create extension if not exists pgcrypto;

create schema if not exists internal;
revoke all on schema internal from public;
revoke all on schema internal from anon, authenticated;

do $$ begin
  create type public.project_category as enum (
    'AI', 'SaaS', 'Games', 'Developer', 'Open Source', 'Design',
    'Mobile', 'Web3', 'Creator', 'Community', 'Other'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g')), '');
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.default_scoring_config()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'weights', jsonb_build_object('supporter', 1, 'uniqueVisit', 2),
    'rating', jsonb_build_object(
      'champion', 100,
      'top10', 70,
      'top25', 40,
      'top50', 15,
      'bottom50', -10
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Identity
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

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  tagline text not null default '' check (char_length(tagline) <= 140),
  description text not null default '' check (char_length(description) <= 1200),
  logo_url text,
  website_url text not null,
  x_url text,
  github_url text,
  category public.project_category not null default 'Other',
  builder_email text not null default '',
  status text not null default 'active' check (status in ('pending', 'active', 'rejected')),
  arena_rating integer not null default 1000 check (arena_rating >= 0),
  total_supporters integer not null default 0 check (total_supporters >= 0),
  total_project_visits integer not null default 0 check (total_project_visits >= 0),
  arena_appearances integer not null default 0 check (arena_appearances >= 0),
  championships integer not null default 0 check (championships >= 0),
  highest_rank integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_owners (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  builder_id uuid not null references public.builders (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  unique (project_id, builder_id)
);

create index if not exists project_owners_builder_idx on public.project_owners (builder_id);
create index if not exists project_owners_project_idx on public.project_owners (project_id);
create index if not exists builders_user_idx on public.builders (user_id);
create index if not exists builders_email_idx on public.builders (email);

-- ---------------------------------------------------------------------------
-- Arenas
-- ---------------------------------------------------------------------------

create table if not exists public.arenas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  number integer not null default 0,
  description text not null default '',
  category text not null default 'Open',
  status text not null default 'draft'
    check (status in ('draft', 'registration', 'full', 'live', 'finished', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  max_entries integer not null default 32 check (max_entries > 0),
  entry_price integer not null default 0 check (entry_price >= 0),
  eligibility_text text not null default '',
  scoring_config jsonb not null default public.default_scoring_config(),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted')),
  spectators integer not null default 0 check (spectators >= 0),
  champion_project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arenas_valid_window check (ends_at > starts_at)
);

create index if not exists arenas_status_starts_idx on public.arenas (status, starts_at);
create index if not exists arenas_champion_idx on public.arenas (champion_project_id);

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

create index if not exists payments_builder_idx on public.payments (builder_id, created_at desc);
create index if not exists payments_arena_idx on public.payments (arena_id, status);
create index if not exists payments_status_idx on public.payments (status) where status in ('pending', 'failed', 'overflow');

create table if not exists public.arena_entries (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  builder_id uuid references public.builders (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  status text not null default 'pending_payment'
    check (status in (
      'pending_payment', 'pending_review', 'approved', 'rejected',
      'withdrawn', 'competing', 'finished', 'disqualified'
    )),
  supporter_count integer not null default 0 check (supporter_count >= 0),
  unique_visit_count integer not null default 0 check (unique_visit_count >= 0),
  impression_count integer not null default 0 check (impression_count >= 0),
  score integer generated always as (supporter_count + (unique_visit_count * 2)) stored,
  current_rank integer,
  final_rank integer,
  rejection_reason text,
  joined_at timestamptz not null default now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists arena_entries_active_unique
  on public.arena_entries (arena_id, project_id)
  where status in ('pending_payment', 'pending_review', 'approved', 'competing');

-- Rejected / withdrawn / finished / disqualified rows must not block a later entry.
-- start_checkout_entry already allows re-entry when the prior row is rejected or withdrawn.
alter table public.arena_entries drop constraint if exists arena_entries_arena_id_project_id_key;

create index if not exists arena_entries_score_idx
  on public.arena_entries (arena_id, score desc, supporter_count desc);
create index if not exists arena_entries_project_idx on public.arena_entries (project_id);
create index if not exists arena_entries_builder_idx on public.arena_entries (builder_id);
create index if not exists arena_entries_status_idx on public.arena_entries (arena_id, status);
create index if not exists arena_entries_payment_idx on public.payments (id);

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Competition events
-- ---------------------------------------------------------------------------

create table if not exists public.supports (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_id uuid not null,
  is_valid boolean not null default true,
  fraud_score integer not null default 0,
  invalid_reason text,
  ip_hash text,
  ua_hash text,
  session_id text,
  created_at timestamptz not null default now(),
  unique (arena_id, project_id, visitor_id)
);

create table if not exists public.outbound_visits (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid references public.arenas (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_id uuid not null,
  is_valid boolean not null default true,
  fraud_score integer not null default 0,
  invalid_reason text,
  ip_hash text,
  ua_hash text,
  session_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists outbound_visits_arena_unique_idx
  on public.outbound_visits (arena_id, project_id, visitor_id)
  where arena_id is not null;
create unique index if not exists outbound_visits_profile_unique_idx
  on public.outbound_visits (project_id, visitor_id)
  where arena_id is null;
create index if not exists supports_project_idx on public.supports (arena_id, project_id, created_at);
create index if not exists supports_visitor_idx on public.supports (visitor_id, created_at);
create index if not exists outbound_visits_project_idx on public.outbound_visits (arena_id, project_id, created_at);

create table if not exists public.project_impressions (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists project_impressions_lookup_idx
  on public.project_impressions (arena_id, project_id, visitor_id, created_at desc);
create index if not exists project_impressions_arena_idx
  on public.project_impressions (arena_id, project_id);

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

create index if not exists fraud_flags_status_idx on public.fraud_flags (status, created_at desc);
create index if not exists fraud_flags_arena_idx on public.fraud_flags (arena_id, status);

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

create index if not exists arena_rating_history_project_idx
  on public.arena_rating_history (project_id, created_at desc);

create table if not exists public.rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  rank integer not null,
  score integer not null,
  label text not null default 'live',
  captured_at timestamptz not null default now()
);

create index if not exists rank_snapshots_entry_idx
  on public.rank_snapshots (arena_id, project_id, captured_at);

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

create index if not exists analytics_events_name_idx on public.analytics_events (name, created_at desc);
create index if not exists analytics_events_arena_idx on public.analytics_events (arena_id, name);

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

create index if not exists email_outbox_status_idx on public.email_outbox (status, created_at);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists builders_touch on public.builders;
create trigger builders_touch before update on public.builders
  for each row execute function public.touch_updated_at();

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists arenas_touch on public.arenas;
create trigger arenas_touch before update on public.arenas
  for each row execute function public.touch_updated_at();

drop trigger if exists arena_entries_touch on public.arena_entries;
create trigger arena_entries_touch before update on public.arena_entries
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.builders (user_id, email, display_name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'builder'), '@', 1))
  )
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = case
          when public.builders.display_name = '' then excluded.display_name
          else public.builders.display_name
        end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

create or replace view public.arena_standings
with (security_invoker = true)
as
select
  ae.id as entry_id,
  ae.arena_id,
  a.slug as arena_slug,
  a.status as arena_status,
  ae.project_id,
  p.slug as project_slug,
  p.name as project_name,
  p.tagline,
  p.description,
  p.logo_url,
  p.website_url,
  p.x_url,
  p.github_url,
  p.category,
  p.arena_rating,
  p.total_supporters,
  p.total_project_visits,
  p.arena_appearances,
  p.championships,
  p.highest_rank,
  ae.supporter_count,
  ae.unique_visit_count,
  ae.impression_count,
  ae.score,
  ae.current_rank,
  ae.final_rank,
  ae.status as entry_status,
  ae.joined_at,
  rank() over (
    partition by ae.arena_id
    order by ae.score desc, ae.supporter_count desc, ae.joined_at asc
  ) as rank,
  round(100.0 * ae.score / nullif(sum(ae.score) over (partition by ae.arena_id), 0), 1) as score_share
from public.arena_entries ae
join public.projects p on p.id = ae.project_id
join public.arenas a on a.id = ae.arena_id
where ae.status in ('approved', 'competing', 'finished')
  and p.status = 'active';

-- ---------------------------------------------------------------------------
-- Occupancy / rating helpers
-- ---------------------------------------------------------------------------

create or replace function public.arena_occupied_count(p_arena_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.arena_entries
  where arena_id = p_arena_id
    and status in ('pending_review', 'approved', 'competing');
$$;

create or replace function public.arena_held_count(p_arena_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.arena_entries
  where arena_id = p_arena_id
    and status = 'pending_payment'
    and created_at > now() - interval '30 minutes';
$$;

create or replace function public.rating_delta_for_rank(
  p_rank integer,
  p_field integer,
  p_config jsonb
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_rating jsonb := coalesce(p_config->'rating', public.default_scoring_config()->'rating');
  v_pct numeric;
begin
  if p_rank is null or p_field is null or p_field < 1 then
    return 0;
  end if;
  if p_rank = 1 then
    return coalesce((v_rating->>'champion')::integer, 100);
  end if;
  v_pct := p_rank::numeric / p_field::numeric;
  if v_pct <= 0.10 then
    return coalesce((v_rating->>'top10')::integer, 70);
  elsif v_pct <= 0.25 then
    return coalesce((v_rating->>'top25')::integer, 40);
  elsif v_pct <= 0.50 then
    return coalesce((v_rating->>'top50')::integer, 15);
  end if;
  return coalesce((v_rating->>'bottom50')::integer, -10);
end;
$$;

create or replace function public.sync_arena_capacity(p_arena_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_max integer;
  v_occupied integer;
begin
  select status, max_entries into v_status, v_max
  from public.arenas where id = p_arena_id for update;
  if v_status not in ('registration', 'full') then
    return;
  end if;
  v_occupied := public.arena_occupied_count(p_arena_id);
  if v_occupied >= v_max and v_status = 'registration' then
    update public.arenas set status = 'full' where id = p_arena_id;
  elsif v_occupied < v_max and v_status = 'full' then
    update public.arenas set status = 'registration' where id = p_arena_id;
  end if;
end;
$$;

create or replace function public.snapshot_ranks(p_arena_id uuid, p_label text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.rank_snapshots (arena_id, project_id, rank, score, label)
  select
    ae.arena_id,
    ae.project_id,
    rank() over (order by ae.score desc, ae.supporter_count desc, ae.joined_at asc)::integer,
    ae.score,
    p_label
  from public.arena_entries ae
  where ae.arena_id = p_arena_id
    and ae.status in ('competing', 'finished', 'approved');
end;
$$;

create or replace function public.refresh_current_ranks(p_arena_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.arena_entries ae
  set current_rank = ranked.rank
  from (
    select id, rank() over (order by score desc, supporter_count desc, joined_at asc)::integer as rank
    from public.arena_entries
    where arena_id = p_arena_id
      and status in ('competing', 'approved', 'finished')
  ) ranked
  where ae.id = ranked.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auth helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_owners po
    join public.builders b on b.id = po.builder_id
    where po.project_id = p_project_id
      and b.user_id = (select auth.uid())
  );
$$;

create or replace function public.ensure_builder()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_email text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select id into v_id from public.builders where user_id = v_uid;
  if v_id is not null then
    return v_id;
  end if;
  select email into v_email from auth.users where id = v_uid;
  insert into public.builders (user_id, email, display_name)
  values (v_uid, lower(coalesce(v_email, '')), split_part(coalesce(v_email, 'builder'), '@', 1))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scoring events
-- ---------------------------------------------------------------------------

create or replace function public.record_support(
  p_project_slug text,
  p_arena_slug text,
  p_visitor_id uuid,
  p_ip_hash text default null,
  p_ua_hash text default null,
  p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arena_id uuid;
  v_project_id uuid;
  v_entry_id uuid;
  v_inserted integer;
  v_valid boolean := true;
  v_score integer := 0;
  v_reason text;
  v_recent integer;
  v_ip_burst integer;
  v_spike integer;
begin
  select a.id, p.id, ae.id
    into v_arena_id, v_project_id, v_entry_id
  from public.arena_entries ae
  join public.arenas a on a.id = ae.arena_id
  join public.projects p on p.id = ae.project_id
  where a.slug = p_arena_slug
    and p.slug = p_project_slug
    and a.status = 'live'
    and ae.status = 'competing';

  if v_entry_id is null then
    raise exception 'project is not competing in this live Arena';
  end if;

  if p_visitor_id is null then
    v_valid := false;
    v_score := 80;
    v_reason := 'missing_visitor';
  end if;

  select count(*) into v_recent
  from public.supports
  where visitor_id = p_visitor_id
    and created_at > now() - interval '1 hour';
  if v_recent >= 40 then
    v_valid := false;
    v_score := greatest(v_score, 70);
    v_reason := coalesce(v_reason, 'visitor_rate');
  end if;

  if p_ip_hash is not null then
    select count(*) into v_ip_burst
    from public.supports
    where arena_id = v_arena_id
      and ip_hash = p_ip_hash
      and created_at > now() - interval '10 minutes';
    if v_ip_burst >= 12 then
      v_score := greatest(v_score, 60);
      v_reason := coalesce(v_reason, 'ip_burst');
      if v_ip_burst >= 24 then
        v_valid := false;
      end if;
    end if;
  end if;

  insert into public.supports (
    arena_id, project_id, visitor_id, is_valid, fraud_score, invalid_reason, ip_hash, ua_hash, session_id
  )
  values (
    v_arena_id, v_project_id, p_visitor_id, v_valid, v_score, v_reason, p_ip_hash, p_ua_hash, p_session_id
  )
  on conflict (arena_id, project_id, visitor_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return jsonb_build_object('duplicate', true, 'valid', false);
  end if;

  if v_valid then
    update public.arena_entries
      set supporter_count = supporter_count + 1
      where id = v_entry_id;
    update public.projects
      set total_supporters = total_supporters + 1
      where id = v_project_id;
  else
    insert into public.fraud_flags (arena_id, project_id, event_type, reason, severity)
    values (v_arena_id, v_project_id, 'support', coalesce(v_reason, 'invalid_support'), 'medium');
  end if;

  select count(*) into v_spike
  from public.supports
  where arena_id = v_arena_id
    and project_id = v_project_id
    and is_valid
    and created_at > now() - interval '5 minutes';
  if v_spike >= 40 then
    insert into public.fraud_flags (arena_id, project_id, event_type, reason, severity)
    values (v_arena_id, v_project_id, 'support_spike', 'rapid_support_spike', 'high');
  end if;

  return jsonb_build_object('duplicate', false, 'valid', v_valid);
end;
$$;

create or replace function public.record_outbound_visit(
  p_project_slug text,
  p_arena_slug text default null,
  p_visitor_id uuid default null,
  p_ip_hash text default null,
  p_ua_hash text default null,
  p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arena_id uuid;
  v_project_id uuid;
  v_entry_id uuid;
  v_inserted integer;
  v_valid boolean := true;
  v_score integer := 0;
  v_reason text;
  v_recent integer;
begin
  if p_visitor_id is null then raise exception 'visitor id is required'; end if;
  select id into v_project_id from public.projects where slug = p_project_slug and status = 'active';
  if v_project_id is null then raise exception 'unknown project'; end if;

  if p_arena_slug is not null then
    select a.id, ae.id into v_arena_id, v_entry_id
    from public.arenas a
    join public.arena_entries ae on ae.arena_id = a.id
    where a.slug = p_arena_slug
      and a.status = 'live'
      and ae.project_id = v_project_id
      and ae.status = 'competing';
  end if;

  select count(*) into v_recent
  from public.outbound_visits
  where visitor_id = p_visitor_id
    and created_at > now() - interval '10 minutes';
  if v_recent >= 30 then
    v_valid := false;
    v_score := 65;
    v_reason := 'visit_rate';
  end if;

  insert into public.outbound_visits (
    arena_id, project_id, visitor_id, is_valid, fraud_score, invalid_reason, ip_hash, ua_hash, session_id
  )
  values (
    v_arena_id, v_project_id, p_visitor_id, v_valid, v_score, v_reason, p_ip_hash, p_ua_hash, p_session_id
  )
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return jsonb_build_object('duplicate', true, 'valid', false); end if;

  if v_valid then
    update public.projects
      set total_project_visits = total_project_visits + 1
      where id = v_project_id;
    if v_entry_id is not null then
      update public.arena_entries
        set unique_visit_count = unique_visit_count + 1
        where id = v_entry_id;
    end if;
  else
    insert into public.fraud_flags (arena_id, project_id, event_type, reason, severity)
    values (v_arena_id, v_project_id, 'outbound_visit', coalesce(v_reason, 'invalid_visit'), 'medium');
  end if;

  return jsonb_build_object('duplicate', false, 'valid', v_valid);
end;
$$;

create or replace function public.record_impression(
  p_project_slug text,
  p_arena_slug text,
  p_visitor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arena_id uuid;
  v_project_id uuid;
  v_entry_id uuid;
  v_recent timestamptz;
begin
  if p_visitor_id is null then raise exception 'visitor id is required'; end if;

  select a.id, p.id, ae.id into v_arena_id, v_project_id, v_entry_id
  from public.arenas a
  join public.projects p on p.slug = p_project_slug
  left join public.arena_entries ae
    on ae.arena_id = a.id and ae.project_id = p.id
    and ae.status in ('approved', 'competing', 'finished')
  where a.slug = p_arena_slug
    and a.status in ('live', 'finished', 'registration', 'full');

  if v_arena_id is null or v_project_id is null then
    raise exception 'unknown arena or project';
  end if;

  select created_at into v_recent
  from public.project_impressions
  where arena_id = v_arena_id
    and project_id = v_project_id
    and visitor_id = p_visitor_id
  order by created_at desc
  limit 1;

  if v_recent is not null and v_recent > now() - interval '30 minutes' then
    return jsonb_build_object('duplicate', true);
  end if;

  insert into public.project_impressions (arena_id, project_id, visitor_id)
  values (v_arena_id, v_project_id, p_visitor_id);

  if v_entry_id is not null then
    update public.arena_entries
      set impression_count = impression_count + 1
      where id = v_entry_id;
  end if;

  return jsonb_build_object('duplicate', false);
end;
$$;

create or replace function public.track_event(
  p_name text,
  p_visitor_id uuid default null,
  p_builder_id uuid default null,
  p_arena_id uuid default null,
  p_project_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.analytics_events (name, visitor_id, builder_id, arena_id, project_id, payload)
  values (p_name, p_visitor_id, p_builder_id, p_arena_id, p_project_id, coalesce(p_payload, '{}'::jsonb));
end;
$$;

create or replace function public.queue_email(
  p_template text,
  p_to_email text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.email_outbox (template, to_email, payload)
  values (p_template, lower(p_to_email), coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Checkout + fulfillment
-- ---------------------------------------------------------------------------

create or replace function public.start_checkout_entry(
  p_arena_id uuid,
  p_project_id uuid,
  p_builder_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arena public.arenas%rowtype;
  v_entry_id uuid;
  v_payment_id uuid;
  v_occupied integer;
  v_held integer;
begin
  select * into v_arena from public.arenas where id = p_arena_id for update;
  if not found then raise exception 'arena_not_found'; end if;
  if v_arena.status not in ('registration') then
    if v_arena.status = 'full' then raise exception 'arena_full'; end if;
    raise exception 'arena_closed';
  end if;
  if v_arena.registration_opens_at is not null and v_arena.registration_opens_at > now() then
    raise exception 'registration_not_open';
  end if;
  if v_arena.registration_closes_at is not null and v_arena.registration_closes_at < now() then
    raise exception 'registration_closed';
  end if;
  if now() >= v_arena.starts_at then
    raise exception 'arena_closed';
  end if;

  if not exists (
    select 1 from public.project_owners
    where project_id = p_project_id and builder_id = p_builder_id
  ) then
    raise exception 'not_project_owner';
  end if;

  if exists (
    select 1 from public.arena_entries
    where arena_id = p_arena_id
      and project_id = p_project_id
      and status in ('pending_payment', 'pending_review', 'approved', 'competing', 'finished')
  ) then
    raise exception 'already_entered';
  end if;

  v_occupied := public.arena_occupied_count(p_arena_id);
  v_held := public.arena_held_count(p_arena_id);
  if v_occupied + v_held >= v_arena.max_entries then
    perform public.sync_arena_capacity(p_arena_id);
    raise exception 'arena_full';
  end if;

  insert into public.payments (builder_id, project_id, arena_id, amount, currency, status, provider)
  values (p_builder_id, p_project_id, p_arena_id, v_arena.entry_price, 'usd', 'pending', 'stripe')
  returning id into v_payment_id;

  insert into public.arena_entries (arena_id, project_id, builder_id, payment_id, status)
  values (p_arena_id, p_project_id, p_builder_id, v_payment_id, 'pending_payment')
  returning id into v_entry_id;

  return jsonb_build_object(
    'entry_id', v_entry_id,
    'payment_id', v_payment_id,
    'amount', v_arena.entry_price,
    'arena_slug', v_arena.slug,
    'arena_name', v_arena.name
  );
end;
$$;

create or replace function public.confirm_paid_entry(
  p_payment_id uuid,
  p_checkout_id text,
  p_provider_payment_id text default null,
  p_receipt_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_arena public.arenas%rowtype;
  v_entry public.arena_entries%rowtype;
  v_occupied integer;
  v_overflow boolean := false;
  v_email text;
  v_project_name text;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment_not_found'; end if;

  if v_payment.status = 'paid' then
    select * into v_entry from public.arena_entries where payment_id = v_payment.id;
    return jsonb_build_object('idempotent', true, 'entry_id', v_entry.id, 'status', v_entry.status);
  end if;

  select * into v_arena from public.arenas where id = v_payment.arena_id for update;
  select * into v_entry from public.arena_entries where payment_id = v_payment.id for update;

  update public.payments
    set status = 'paid',
        provider_checkout_id = coalesce(provider_checkout_id, p_checkout_id),
        provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
        receipt_url = coalesce(p_receipt_url, receipt_url),
        confirmed_at = now()
    where id = v_payment.id;

  if v_arena.status not in ('registration', 'full') then
    v_overflow := true;
  else
    v_occupied := public.arena_occupied_count(v_arena.id);
    if v_occupied >= v_arena.max_entries then
      v_overflow := true;
    end if;
  end if;

  if v_overflow then
    update public.payments set status = 'overflow' where id = v_payment.id;
    insert into public.fraud_flags (arena_id, project_id, event_type, reason, severity)
    values (v_arena.id, v_payment.project_id, 'capacity_race', 'paid_after_capacity', 'high');
    return jsonb_build_object('entry_id', v_entry.id, 'status', 'overflow', 'overflow', true);
  end if;

  update public.arena_entries
    set status = 'pending_review'
    where id = v_entry.id;

  perform public.sync_arena_capacity(v_arena.id);

  select email into v_email from public.builders where id = v_payment.builder_id;
  select name into v_project_name from public.projects where id = v_payment.project_id;
  perform public.queue_email(
    'entry_payment_received',
    v_email,
    jsonb_build_object('arenaName', v_arena.name, 'projectName', v_project_name, 'arenaSlug', v_arena.slug)
  );
  perform public.track_event('checkout_completed', null, v_payment.builder_id, v_arena.id, v_payment.project_id, '{}'::jsonb);

  return jsonb_build_object('entry_id', v_entry.id, 'status', 'pending_review', 'overflow', false);
end;
$$;

create or replace function public.fail_payment(
  p_payment_id uuid,
  p_checkout_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payments
    set status = 'failed',
        provider_checkout_id = coalesce(provider_checkout_id, p_checkout_id)
    where id = p_payment_id
      and status = 'pending';
  update public.arena_entries
    set status = 'withdrawn'
    where payment_id = p_payment_id
      and status = 'pending_payment';
end;
$$;

create or replace function public.mark_payment_refunded(
  p_payment_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payments
    set status = 'refunded',
        refund_reason = coalesce(p_reason, refund_reason),
        refunded_at = now()
    where id = p_payment_id;
end;
$$;

create or replace function public.approve_entry(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.arena_entries%rowtype;
  v_arena public.arenas%rowtype;
  v_next text;
  v_email text;
  v_project_name text;
begin
  select * into v_entry from public.arena_entries where id = p_entry_id for update;
  if not found then raise exception 'entry_not_found'; end if;
  if v_entry.status <> 'pending_review' then
    raise exception 'entry_not_pending';
  end if;
  select * into v_arena from public.arenas where id = v_entry.arena_id for update;

  if v_arena.status in ('finished', 'cancelled') then
    raise exception 'arena_closed';
  end if;

  if public.arena_occupied_count(v_arena.id) > v_arena.max_entries then
    raise exception 'arena_full';
  end if;

  v_next := case when v_arena.status = 'live' then 'competing' else 'approved' end;

  update public.arena_entries
    set status = v_next, approved_at = now()
    where id = p_entry_id;

  perform public.sync_arena_capacity(v_arena.id);

  select email into v_email from public.builders where id = v_entry.builder_id;
  select name into v_project_name from public.projects where id = v_entry.project_id;
  perform public.queue_email(
    'entry_approved',
    v_email,
    jsonb_build_object('arenaName', v_arena.name, 'projectName', v_project_name, 'arenaSlug', v_arena.slug)
  );
  perform public.track_event('entry_approved', null, v_entry.builder_id, v_arena.id, v_entry.project_id, '{}'::jsonb);

  return jsonb_build_object('status', v_next);
end;
$$;

create or replace function public.reject_entry(p_entry_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arena_id uuid;
begin
  update public.arena_entries
    set status = 'rejected',
        rejection_reason = p_reason,
        rejected_at = now()
    where id = p_entry_id
      and status in ('pending_review', 'approved', 'pending_payment')
    returning arena_id into v_arena_id;
  if v_arena_id is not null then
    perform public.sync_arena_capacity(v_arena_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lifecycle
-- ---------------------------------------------------------------------------

create or replace function public.start_arena(p_arena_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arena public.arenas%rowtype;
begin
  select * into v_arena from public.arenas where id = p_arena_id for update;
  if not found then return; end if;
  if v_arena.status in ('live', 'finished', 'cancelled') then return; end if;

  update public.arena_entries
    set status = 'competing'
    where arena_id = p_arena_id and status = 'approved';

  update public.arenas set status = 'live' where id = p_arena_id;

  perform public.refresh_current_ranks(p_arena_id);
  perform public.snapshot_ranks(p_arena_id, 'started');
  perform public.track_event('arena_started', null, null, p_arena_id, null, '{}'::jsonb);

  insert into public.email_outbox (template, to_email, payload)
  select
    'arena_starting',
    b.email,
    jsonb_build_object('arenaName', v_arena.name, 'projectName', p.name, 'arenaSlug', v_arena.slug)
  from public.arena_entries ae
  join public.builders b on b.id = ae.builder_id
  join public.projects p on p.id = ae.project_id
  where ae.arena_id = p_arena_id and ae.status = 'competing';
end;
$$;

create or replace function public.finalize_arena_by_id(p_arena_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arena public.arenas%rowtype;
  v_field integer;
  v_champion uuid;
begin
  select * into v_arena from public.arenas where id = p_arena_id for update;
  if not found then return; end if;
  if v_arena.status = 'finished' then return; end if;
  if v_arena.status = 'cancelled' then return; end if;

  perform public.refresh_current_ranks(p_arena_id);

  update public.arena_entries ae
  set final_rank = ranked.rank,
      current_rank = ranked.rank,
      status = 'finished'
  from (
    select id, rank() over (order by score desc, supporter_count desc, joined_at asc)::integer as rank
    from public.arena_entries
    where arena_id = p_arena_id and status = 'competing'
  ) ranked
  where ae.id = ranked.id;

  select count(*) into v_field
  from public.arena_entries
  where arena_id = p_arena_id and status = 'finished';

  select project_id into v_champion
  from public.arena_entries
  where arena_id = p_arena_id and status = 'finished' and final_rank = 1
  limit 1;

  insert into public.arena_rating_history (project_id, arena_id, rating_before, rating_change, rating_after)
  select
    p.id,
    p_arena_id,
    p.arena_rating,
    public.rating_delta_for_rank(ae.final_rank, v_field, v_arena.scoring_config),
    greatest(0, p.arena_rating + public.rating_delta_for_rank(ae.final_rank, v_field, v_arena.scoring_config))
  from public.arena_entries ae
  join public.projects p on p.id = ae.project_id
  where ae.arena_id = p_arena_id and ae.status = 'finished'
  on conflict (project_id, arena_id) do nothing;

  update public.projects p set
    arena_appearances = arena_appearances + 1,
    championships = championships + case when ae.final_rank = 1 then 1 else 0 end,
    highest_rank = least(coalesce(highest_rank, ae.final_rank), ae.final_rank),
    arena_rating = h.rating_after
  from public.arena_entries ae
  join public.arena_rating_history h
    on h.project_id = ae.project_id and h.arena_id = ae.arena_id
  where ae.project_id = p.id
    and ae.arena_id = p_arena_id
    and ae.status = 'finished';

  update public.arenas
    set status = 'finished',
        champion_project_id = v_champion
    where id = p_arena_id;

  perform public.snapshot_ranks(p_arena_id, 'final');

  insert into public.email_outbox (template, to_email, payload)
  select
    'arena_finished',
    b.email,
    jsonb_build_object(
      'arenaName', v_arena.name,
      'projectName', p.name,
      'arenaSlug', v_arena.slug,
      'rank', ae.final_rank,
      'field', v_field,
      'projectSlug', p.slug
    )
  from public.arena_entries ae
  join public.builders b on b.id = ae.builder_id
  join public.projects p on p.id = ae.project_id
  where ae.arena_id = p_arena_id and ae.status = 'finished';
end;
$$;

-- Back-compat name used by Phase 1 operators.
create or replace function public.finalize_arena(p_arena_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.arenas where slug = p_arena_slug;
  if v_id is not null then
    perform public.finalize_arena_by_id(v_id);
  end if;
end;
$$;

create or replace function public.cancel_arena(p_arena_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.arenas set status = 'cancelled' where id = p_arena_id and status not in ('finished');
  update public.arena_entries
    set status = case
      when status in ('competing', 'approved', 'pending_review', 'pending_payment') then 'withdrawn'
      else status
    end
    where arena_id = p_arena_id
      and status in ('competing', 'approved', 'pending_review', 'pending_payment');
end;
$$;

create or replace function public.reconcile_arenas()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_started integer := 0;
  v_finished integer := 0;
  v_opened integer := 0;
  v_last_snap timestamptz;
begin
  update public.arena_entries
    set status = 'withdrawn'
    where status = 'pending_payment'
      and created_at < now() - interval '30 minutes';

  update public.payments
    set status = 'cancelled'
    where status = 'pending'
      and created_at < now() - interval '30 minutes'
      and id in (
        select payment_id from public.arena_entries
        where status = 'withdrawn' and payment_id is not null
      );

  for r in
    select id from public.arenas
    where status = 'draft'
      and registration_opens_at is not null
      and registration_opens_at <= now()
      and starts_at > now()
  loop
    update public.arenas set status = 'registration' where id = r.id;
    v_opened := v_opened + 1;
  end loop;

  for r in
    select id from public.arenas where status in ('registration', 'full')
  loop
    perform public.sync_arena_capacity(r.id);
  end loop;

  for r in
    select id from public.arenas
    where status in ('registration', 'full')
      and starts_at <= now()
      and ends_at > now()
  loop
    perform public.start_arena(r.id);
    v_started := v_started + 1;
  end loop;

  for r in
    select id from public.arenas
    where status = 'live' and ends_at <= now()
  loop
    perform public.finalize_arena_by_id(r.id);
    v_finished := v_finished + 1;
  end loop;

  for r in
    select id from public.arenas where status = 'live'
  loop
    perform public.refresh_current_ranks(r.id);
    select max(captured_at) into v_last_snap
    from public.rank_snapshots
    where arena_id = r.id and label = 'live';
    if v_last_snap is null or v_last_snap < now() - interval '60 minutes' then
      perform public.snapshot_ranks(r.id, 'live');
    end if;
  end loop;

  return jsonb_build_object('opened', v_opened, 'started', v_started, 'finished', v_finished);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.builders enable row level security;
alter table public.admins enable row level security;
alter table public.projects enable row level security;
alter table public.project_owners enable row level security;
alter table public.arenas enable row level security;
alter table public.arena_entries enable row level security;
alter table public.payments enable row level security;
alter table public.supports enable row level security;
alter table public.outbound_visits enable row level security;
alter table public.project_impressions enable row level security;
alter table public.fraud_flags enable row level security;
alter table public.arena_rating_history enable row level security;
alter table public.rank_snapshots enable row level security;
alter table public.analytics_events enable row level security;
alter table public.email_outbox enable row level security;
alter table public.stripe_events enable row level security;

drop policy if exists "builders read own" on public.builders;
create policy "builders read own" on public.builders
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

drop policy if exists "builders update own" on public.builders;
create policy "builders update own" on public.builders
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "active projects are public" on public.projects;
create policy "active projects are public" on public.projects
  for select to anon, authenticated
  using (status = 'active' or public.owns_project(id) or public.is_admin());

drop policy if exists "owners update projects" on public.projects;
create policy "owners update projects" on public.projects
  for update to authenticated
  using (public.owns_project(id) or public.is_admin())
  with check (public.owns_project(id) or public.is_admin());

drop policy if exists "owners insert projects" on public.projects;
create policy "owners insert projects" on public.projects
  for insert to authenticated
  with check (true);

drop policy if exists "owners read mapping" on public.project_owners;
create policy "owners read mapping" on public.project_owners
  for select to authenticated
  using (
    builder_id in (select id from public.builders where user_id = (select auth.uid()))
    or public.is_admin()
  );

drop policy if exists "public arenas" on public.arenas;
create policy "public arenas" on public.arenas
  for select to anon, authenticated
  using (visibility = 'public' and status <> 'draft' or public.is_admin());

drop policy if exists "visible entries" on public.arena_entries;
create policy "visible entries" on public.arena_entries
  for select to anon, authenticated
  using (
    status in ('approved', 'competing', 'finished')
    or builder_id in (select id from public.builders where user_id = (select auth.uid()))
    or public.is_admin()
  );

drop policy if exists "payments own" on public.payments;
create policy "payments own" on public.payments
  for select to authenticated
  using (
    builder_id in (select id from public.builders where user_id = (select auth.uid()))
    or public.is_admin()
  );

drop policy if exists "rating history public" on public.arena_rating_history;
create policy "rating history public" on public.arena_rating_history
  for select to anon, authenticated using (true);

drop policy if exists "rank snapshots public" on public.rank_snapshots;
create policy "rank snapshots public" on public.rank_snapshots
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Grants (explicit — Data API does not auto-expose new tables)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

revoke all on public.projects, public.arenas, public.arena_entries,
  public.supports, public.outbound_visits, public.builders, public.project_owners,
  public.payments, public.project_impressions, public.fraud_flags,
  public.arena_rating_history, public.rank_snapshots, public.analytics_events,
  public.email_outbox, public.stripe_events, public.admins
from anon, authenticated;

grant select (
  id, name, slug, tagline, description, logo_url, website_url, x_url, github_url,
  category, status, arena_rating, total_supporters, total_project_visits,
  arena_appearances, championships, highest_rank, created_at
) on public.projects to anon, authenticated;

grant select on public.arenas, public.arena_entries, public.arena_standings,
  public.arena_rating_history, public.rank_snapshots to anon, authenticated;

-- Column grant lets arena_entries RLS subquery builders without exposing email.
grant select (id, user_id, display_name, avatar_url) on public.builders to anon;
grant select on public.builders to authenticated;
grant select, insert, update on public.project_owners to authenticated;
grant insert, update on public.projects to authenticated;
grant select on public.payments to authenticated;

grant execute on function public.ensure_builder() to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.owns_project(uuid) to anon, authenticated;
grant execute on function public.slugify(text) to anon, authenticated;

revoke all on function public.record_support(text, text, uuid, text, text, text) from public;
revoke all on function public.record_outbound_visit(text, text, uuid, text, text, text) from public;
revoke all on function public.record_impression(text, text, uuid) from public;
revoke all on function public.track_event(text, uuid, uuid, uuid, uuid, jsonb) from public;
revoke all on function public.start_checkout_entry(uuid, uuid, uuid) from public;
revoke all on function public.confirm_paid_entry(uuid, text, text, text) from public;
revoke all on function public.fail_payment(uuid, text) from public;
revoke all on function public.approve_entry(uuid) from public;
revoke all on function public.reject_entry(uuid, text) from public;
revoke all on function public.reconcile_arenas() from public;
revoke all on function public.start_arena(uuid) from public;
revoke all on function public.finalize_arena_by_id(uuid) from public;
revoke all on function public.finalize_arena(text) from public;
revoke all on function public.cancel_arena(uuid) from public;
revoke all on function public.queue_email(text, text, jsonb) from public;
revoke all on function public.mark_payment_refunded(uuid, text) from public;

grant execute on function public.record_support(text, text, uuid, text, text, text) to service_role;
grant execute on function public.record_outbound_visit(text, text, uuid, text, text, text) to service_role;
grant execute on function public.record_impression(text, text, uuid) to service_role;
grant execute on function public.track_event(text, uuid, uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.start_checkout_entry(uuid, uuid, uuid) to service_role;
grant execute on function public.confirm_paid_entry(uuid, text, text, text) to service_role;
grant execute on function public.fail_payment(uuid, text) to service_role;
grant execute on function public.approve_entry(uuid) to service_role;
grant execute on function public.reject_entry(uuid, text) to service_role;
grant execute on function public.reconcile_arenas() to service_role;
grant execute on function public.start_arena(uuid) to service_role;
grant execute on function public.finalize_arena_by_id(uuid) to service_role;
grant execute on function public.finalize_arena(text) to service_role;
grant execute on function public.cancel_arena(uuid) to service_role;
grant execute on function public.queue_email(text, text, jsonb) to service_role;
grant execute on function public.mark_payment_refunded(uuid, text) to service_role;
grant execute on function public.handle_new_user() to postgres, service_role;

-- Phase 1 compatibility shims
drop function if exists public.create_paid_entry(text, text, text, text, text, text, text, text, text, text, text);

create or replace function public.record_support(p_project_slug text, p_arena_slug text, p_visitor_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.record_support(p_project_slug, p_arena_slug, p_visitor_id, null::text, null::text, null::text);
$$;

create or replace function public.record_outbound_visit(p_project_slug text, p_arena_slug text, p_visitor_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.record_outbound_visit(p_project_slug, p_arena_slug, p_visitor_id, null::text, null::text, null::text);
$$;

revoke all on function public.record_support(text, text, uuid) from public;
revoke all on function public.record_outbound_visit(text, text, uuid) from public;
grant execute on function public.record_support(text, text, uuid) to service_role;
grant execute on function public.record_outbound_visit(text, text, uuid) to service_role;
