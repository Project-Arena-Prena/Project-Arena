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


-- ===========================================================================
-- PHASE 3 — $PRENA utility layer (identical to migrations/004_phase3_prena.sql)
-- ===========================================================================

-- Project Arena — Phase 3: $PRENA utility layer.
-- Idempotent. Safe to re-run. Appended verbatim to supabase/schema.sql.
--
-- HARD RULE ENFORCED HERE: nothing in this migration writes to
-- arena_entries.supporter_count / unique_visit_count / score / current_rank /
-- final_rank, or to projects.arena_rating. Token spend cannot touch rank.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Arena configuration (never hard-coded in application code)
-- ---------------------------------------------------------------------------

alter table public.arenas add column if not exists prena_payment_enabled boolean not null default false;
alter table public.arenas add column if not exists prena_discount_percent integer not null default 0;
alter table public.arenas add column if not exists reward_pool_enabled boolean not null default false;
alter table public.arenas add column if not exists prena_early_registration_at timestamptz;

do $$ begin
  alter table public.arenas
    add constraint arenas_prena_discount_range
    check (prena_discount_percent between 0 and 90);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Wallet linking
-- ---------------------------------------------------------------------------

create table if not exists public.builder_wallets (
  id uuid primary key default gen_random_uuid(),
  builder_id uuid not null references public.builders (id) on delete cascade,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  chain_id integer not null check (chain_id > 0),
  label text,
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- One wallet address belongs to exactly one Builder. Blocks benefit farming
-- by rotating a single funded wallet through many accounts.
create unique index if not exists builder_wallets_address_unique
  on public.builder_wallets (wallet_address);
create unique index if not exists builder_wallets_primary_unique
  on public.builder_wallets (builder_id) where is_primary;
create index if not exists builder_wallets_builder_idx
  on public.builder_wallets (builder_id, created_at desc);

-- Server-issued challenges. A wallet address arriving from the client is never
-- trusted until a signature over one of these rows verifies.
create table if not exists public.wallet_nonces (
  id uuid primary key default gen_random_uuid(),
  builder_id uuid not null references public.builders (id) on delete cascade,
  nonce text not null unique,
  purpose text not null default 'link' check (purpose in ('link', 'claim')),
  wallet_address text check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  chain_id integer,
  allocation_id uuid,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wallet_nonces_builder_idx
  on public.wallet_nonces (builder_id, created_at desc);
create index if not exists wallet_nonces_expiry_idx
  on public.wallet_nonces (expires_at) where consumed_at is null;

-- ---------------------------------------------------------------------------
-- Quotes — authoritative token amounts are minted server side and expire.
-- ---------------------------------------------------------------------------

create table if not exists public.prena_quotes (
  id uuid primary key default gen_random_uuid(),
  builder_id uuid not null references public.builders (id) on delete cascade,
  arena_id uuid not null references public.arenas (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  usd_amount_cents integer not null check (usd_amount_cents >= 0),
  discount_percent integer not null default 0 check (discount_percent between 0 and 90),
  discounted_usd_cents integer not null check (discounted_usd_cents >= 0),
  token_symbol text not null default 'PRENA',
  token_contract text,
  chain_id integer not null,
  token_decimals integer not null default 18 check (token_decimals between 0 and 36),
  -- Base units, stored as text. PostgREST returns numeric as a JavaScript
  -- number, which silently destroys uint256 precision — an amount check
  -- against a mangled value would accept an underpayment.
  token_amount text not null check (token_amount ~ '^[0-9]+$'),
  usd_price_per_token numeric(38, 18) not null check (usd_price_per_token > 0),
  price_source text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists prena_quotes_builder_idx
  on public.prena_quotes (builder_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Token payments
-- ---------------------------------------------------------------------------

create table if not exists public.token_payments (
  id uuid primary key default gen_random_uuid(),
  builder_id uuid not null references public.builders (id) on delete restrict,
  arena_id uuid not null references public.arenas (id) on delete restrict,
  project_id uuid not null references public.projects (id) on delete restrict,
  quote_id uuid references public.prena_quotes (id) on delete set null,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  recipient_address text check (recipient_address ~ '^0x[0-9a-f]{40}$'),
  token_symbol text not null default 'PRENA',
  token_contract text,
  chain_id integer not null,
  token_decimals integer not null default 18,
  -- Base units as text; see prena_quotes.token_amount.
  token_amount text not null check (token_amount ~ '^[0-9]+$'),
  quote_usd_value integer not null default 0 check (quote_usd_value >= 0),
  tx_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'confirming', 'confirmed', 'failed', 'expired', 'refunded')),
  mode text not null default 'mock' check (mode in ('mock', 'onchain')),
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

-- One transaction hash can fund exactly one entry, per chain.
create unique index if not exists token_payments_tx_unique
  on public.token_payments (chain_id, lower(tx_hash)) where tx_hash is not null;
create index if not exists token_payments_builder_idx
  on public.token_payments (builder_id, created_at desc);
create index if not exists token_payments_arena_idx
  on public.token_payments (arena_id, status);
create index if not exists token_payments_open_idx
  on public.token_payments (status) where status in ('pending', 'confirming');

-- Upgrades an install that already created these columns as numeric. The old
-- numeric range check has to go first: it cannot be evaluated against text.
-- The prena_activity view reads this column; it is recreated further down.
drop view if exists public.prena_activity;

do $$
declare
  v record;
  c record;
begin
  for v in
    select table_name from information_schema.columns
    where table_schema = 'public'
      and table_name in ('prena_quotes', 'token_payments')
      and column_name = 'token_amount'
      and data_type = 'numeric'
  loop
    for c in
      select con.conname
      from pg_constraint con
      join pg_class cls on cls.oid = con.conrelid
      join pg_namespace ns on ns.oid = cls.relnamespace
      where ns.nspname = 'public'
        and cls.relname = v.table_name
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) ilike '%token_amount%'
    loop
      execute format('alter table public.%I drop constraint %I', v.table_name, c.conname);
    end loop;

    execute format(
      'alter table public.%I alter column token_amount type text using trunc(token_amount)::text',
      v.table_name
    );
    execute format(
      'alter table public.%I add constraint %I check (token_amount ~ ''^[0-9]+$'')',
      v.table_name, v.table_name || '_token_amount_digits'
    );
  end loop;
end $$;

alter table public.arena_entries
  add column if not exists token_payment_id uuid references public.token_payments (id) on delete set null;

create unique index if not exists arena_entries_token_payment_unique
  on public.arena_entries (token_payment_id) where token_payment_id is not null;

-- ---------------------------------------------------------------------------
-- Reward pools
-- ---------------------------------------------------------------------------

create table if not exists public.arena_reward_pools (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null unique references public.arenas (id) on delete cascade,
  token_symbol text not null default 'PRENA',
  token_contract text,
  chain_id integer,
  total_amount numeric(38, 6) not null default 0 check (total_amount >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'announced', 'locked', 'allocated', 'distributed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arena_reward_tiers (
  id uuid primary key default gen_random_uuid(),
  reward_pool_id uuid not null references public.arena_reward_pools (id) on delete cascade,
  reward_type text not null
    check (reward_type in ('champion', 'rank', 'percentile', 'supporter', 'community', 'special')),
  label text not null default '',
  rank_start integer check (rank_start is null or rank_start >= 1),
  rank_end integer check (rank_end is null or rank_end >= 1),
  percentile_start numeric(6, 4) check (percentile_start is null or (percentile_start >= 0 and percentile_start <= 1)),
  percentile_end numeric(6, 4) check (percentile_end is null or (percentile_end >= 0 and percentile_end <= 1)),
  amount numeric(38, 6) check (amount is null or amount >= 0),
  percentage numeric(7, 4) check (percentage is null or (percentage >= 0 and percentage <= 100)),
  distribution text not null default 'split' check (distribution in ('split', 'each')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint arena_reward_tiers_amount_or_percentage check (amount is not null or percentage is not null),
  constraint arena_reward_tiers_rank_order check (rank_end is null or rank_start is null or rank_end >= rank_start)
);

create index if not exists arena_reward_tiers_pool_idx
  on public.arena_reward_tiers (reward_pool_id, position, created_at);

-- ---------------------------------------------------------------------------
-- Reward allocations
-- ---------------------------------------------------------------------------

create table if not exists public.reward_allocations (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  builder_id uuid references public.builders (id) on delete set null,
  tier_id uuid references public.arena_reward_tiers (id) on delete set null,
  wallet_address text check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  reward_type text not null
    check (reward_type in ('champion', 'rank', 'percentile', 'supporter', 'community', 'special')),
  label text not null default '',
  final_rank integer,
  amount numeric(38, 6) not null check (amount > 0),
  token_symbol text not null default 'PRENA',
  token_contract text,
  chain_id integer,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'claimable', 'claimed', 'cancelled')),
  claim_signature text,
  claim_tx_hash text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  claimed_at timestamptz
);

-- One allocation per project per tier — reward generation is re-runnable.
create unique index if not exists reward_allocations_unique
  on public.reward_allocations (arena_id, project_id, tier_id);
-- A payout transaction settles exactly one allocation.
create unique index if not exists reward_allocations_claim_tx_unique
  on public.reward_allocations (chain_id, lower(claim_tx_hash)) where claim_tx_hash is not null;
create index if not exists reward_allocations_builder_idx
  on public.reward_allocations (builder_id, status, created_at desc);
create index if not exists reward_allocations_arena_idx
  on public.reward_allocations (arena_id, status);

do $$ begin
  create trigger arena_reward_pools_touch before update on public.arena_reward_pools
    for each row execute function public.touch_updated_at();
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- prena_activity — derived, not a second ledger.
-- ---------------------------------------------------------------------------

drop view if exists public.prena_activity;
create view public.prena_activity
with (security_invoker = on)
as
select
  tp.id,
  tp.builder_id,
  tp.arena_id,
  tp.project_id,
  'entry'::text as kind,
  'debit'::text as direction,
  (tp.token_amount::numeric / power(10::numeric, tp.token_decimals))::numeric(38, 6) as amount,
  tp.token_symbol,
  tp.status,
  tp.tx_hash,
  tp.chain_id,
  coalesce(tp.confirmed_at, tp.created_at) as occurred_at,
  tp.created_at
from public.token_payments tp
union all
select
  ra.id,
  ra.builder_id,
  ra.arena_id,
  ra.project_id,
  case when ra.status = 'claimed' then 'claim' else 'reward' end,
  'credit',
  ra.amount,
  ra.token_symbol,
  ra.status,
  ra.claim_tx_hash,
  ra.chain_id,
  coalesce(ra.claimed_at, ra.approved_at, ra.created_at),
  ra.created_at
from public.reward_allocations ra
where ra.status <> 'cancelled';

-- ---------------------------------------------------------------------------
-- Entry with $PRENA — mirrors start_checkout_entry / confirm_paid_entry.
-- ---------------------------------------------------------------------------

create or replace function public.start_prena_entry(
  p_arena_id uuid,
  p_project_id uuid,
  p_builder_id uuid,
  p_quote_id uuid,
  p_wallet_address text,
  p_recipient_address text,
  p_mode text default 'mock'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arena public.arenas%rowtype;
  v_quote public.prena_quotes%rowtype;
  v_entry_id uuid;
  v_payment_id uuid;
begin
  select * into v_arena from public.arenas where id = p_arena_id for update;
  if not found then raise exception 'arena_not_found'; end if;
  if not v_arena.prena_payment_enabled then raise exception 'prena_entry_disabled'; end if;
  if v_arena.status <> 'registration' then
    if v_arena.status = 'full' then raise exception 'arena_full'; end if;
    raise exception 'arena_closed';
  end if;
  if v_arena.registration_opens_at is not null and v_arena.registration_opens_at > now() then
    raise exception 'registration_not_open';
  end if;
  if v_arena.registration_closes_at is not null and v_arena.registration_closes_at < now() then
    raise exception 'registration_closed';
  end if;
  if now() >= v_arena.starts_at then raise exception 'arena_closed'; end if;

  select * into v_quote from public.prena_quotes where id = p_quote_id for update;
  if not found then raise exception 'quote_not_found'; end if;
  if v_quote.builder_id <> p_builder_id or v_quote.arena_id <> p_arena_id then
    raise exception 'quote_mismatch';
  end if;
  if v_quote.consumed_at is not null then raise exception 'quote_consumed'; end if;
  if v_quote.expires_at <= now() then raise exception 'quote_expired'; end if;

  if not exists (
    select 1 from public.project_owners
    where project_id = p_project_id and builder_id = p_builder_id
  ) then
    raise exception 'not_project_owner';
  end if;

  if not exists (
    select 1 from public.builder_wallets
    where builder_id = p_builder_id
      and wallet_address = lower(p_wallet_address)
      and verified_at is not null
  ) then
    raise exception 'wallet_not_verified';
  end if;

  if exists (
    select 1 from public.arena_entries
    where arena_id = p_arena_id
      and project_id = p_project_id
      and status in ('pending_payment', 'pending_review', 'approved', 'competing', 'finished')
  ) then
    raise exception 'already_entered';
  end if;

  if public.arena_occupied_count(p_arena_id) + public.arena_held_count(p_arena_id) >= v_arena.max_entries then
    perform public.sync_arena_capacity(p_arena_id);
    raise exception 'arena_full';
  end if;

  update public.prena_quotes set consumed_at = now() where id = p_quote_id;

  insert into public.token_payments (
    builder_id, arena_id, project_id, quote_id, wallet_address, recipient_address,
    token_symbol, token_contract, chain_id, token_decimals, token_amount,
    quote_usd_value, status, mode, expires_at
  ) values (
    p_builder_id, p_arena_id, p_project_id, p_quote_id, lower(p_wallet_address), lower(p_recipient_address),
    v_quote.token_symbol, v_quote.token_contract, v_quote.chain_id, v_quote.token_decimals, v_quote.token_amount,
    v_quote.discounted_usd_cents, 'pending', coalesce(p_mode, 'mock'), now() + interval '30 minutes'
  )
  returning id into v_payment_id;

  insert into public.arena_entries (arena_id, project_id, builder_id, token_payment_id, status)
  values (p_arena_id, p_project_id, p_builder_id, v_payment_id, 'pending_payment')
  returning id into v_entry_id;

  return jsonb_build_object(
    'entry_id', v_entry_id,
    'token_payment_id', v_payment_id,
    'token_amount', v_quote.token_amount,
    'token_decimals', v_quote.token_decimals,
    'token_contract', v_quote.token_contract,
    'chain_id', v_quote.chain_id,
    'recipient_address', lower(p_recipient_address),
    'arena_slug', v_arena.slug,
    'arena_name', v_arena.name
  );
end;
$$;

-- Records the hash the wallet reported. The unique index is the replay guard:
-- a hash already attached to another payment raises here, not later.
create or replace function public.attach_token_payment_tx(
  p_token_payment_id uuid,
  p_builder_id uuid,
  p_tx_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.token_payments%rowtype;
begin
  select * into v_payment from public.token_payments where id = p_token_payment_id for update;
  if not found then raise exception 'payment_not_found'; end if;
  if v_payment.builder_id <> p_builder_id then raise exception 'forbidden'; end if;
  if v_payment.status = 'confirmed' then
    return jsonb_build_object('status', 'confirmed', 'idempotent', true);
  end if;
  if v_payment.status in ('failed', 'expired', 'refunded') then
    raise exception 'payment_closed';
  end if;
  if v_payment.tx_hash is not null and lower(v_payment.tx_hash) <> lower(p_tx_hash) then
    raise exception 'tx_already_attached';
  end if;

  update public.token_payments
    set tx_hash = lower(p_tx_hash),
        status = 'confirming'
    where id = p_token_payment_id;

  return jsonb_build_object('status', 'confirming', 'idempotent', false);
end;
$$;

create or replace function public.confirm_prena_entry(
  p_token_payment_id uuid,
  p_tx_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.token_payments%rowtype;
  v_arena public.arenas%rowtype;
  v_entry public.arena_entries%rowtype;
  v_overflow boolean := false;
  v_email text;
  v_project_name text;
begin
  select * into v_payment from public.token_payments where id = p_token_payment_id for update;
  if not found then raise exception 'payment_not_found'; end if;

  select * into v_entry from public.arena_entries where token_payment_id = v_payment.id for update;

  if v_payment.status = 'confirmed' then
    return jsonb_build_object('idempotent', true, 'entry_id', v_entry.id, 'status', v_entry.status);
  end if;

  select * into v_arena from public.arenas where id = v_payment.arena_id for update;

  update public.token_payments
    set status = 'confirmed',
        tx_hash = lower(coalesce(p_tx_hash, tx_hash)),
        confirmed_at = now()
    where id = v_payment.id;

  if v_arena.status not in ('registration', 'full') then
    v_overflow := true;
  elsif public.arena_occupied_count(v_arena.id) >= v_arena.max_entries then
    v_overflow := true;
  end if;

  if v_overflow then
    update public.token_payments set status = 'refunded', failure_reason = 'paid_after_capacity'
      where id = v_payment.id;
    insert into public.fraud_flags (arena_id, project_id, event_type, reason, severity)
    values (v_arena.id, v_payment.project_id, 'capacity_race', 'prena_paid_after_capacity', 'high');
    return jsonb_build_object('entry_id', v_entry.id, 'status', 'overflow', 'overflow', true);
  end if;

  update public.arena_entries set status = 'pending_review' where id = v_entry.id;
  perform public.sync_arena_capacity(v_arena.id);

  select email into v_email from public.builders where id = v_payment.builder_id;
  select name into v_project_name from public.projects where id = v_payment.project_id;
  perform public.queue_email(
    'entry_payment_received',
    v_email,
    jsonb_build_object('arenaName', v_arena.name, 'projectName', v_project_name, 'arenaSlug', v_arena.slug)
  );
  perform public.track_event(
    'prena_payment_confirmed', null, v_payment.builder_id, v_arena.id, v_payment.project_id,
    jsonb_build_object('tokenAmount', v_payment.token_amount::text, 'chainId', v_payment.chain_id)
  );

  return jsonb_build_object('entry_id', v_entry.id, 'status', 'pending_review', 'overflow', false);
end;
$$;

create or replace function public.fail_token_payment(
  p_token_payment_id uuid,
  p_reason text default null,
  p_status text default 'failed'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.token_payments
    set status = case when p_status in ('failed', 'expired') then p_status else 'failed' end,
        failure_reason = coalesce(p_reason, failure_reason)
    where id = p_token_payment_id
      and status in ('pending', 'confirming');
  update public.arena_entries
    set status = 'withdrawn'
    where token_payment_id = p_token_payment_id
      and status = 'pending_payment';
end;
$$;

-- Sweeps abandoned holds so they stop occupying capacity.
create or replace function public.expire_token_payments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  for v_row in
    select id from public.token_payments
    where status in ('pending', 'confirming')
      and expires_at is not null and expires_at < now()
  loop
    perform public.fail_token_payment(v_row.id, 'quote_window_elapsed', 'expired');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reward engine
--
-- Reads final_rank, which finalize_arena_by_id already froze from Arena
-- scoring alone. It never writes back into scoring columns.
-- ---------------------------------------------------------------------------

create or replace function public.generate_arena_reward_allocations(p_arena_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arena public.arenas%rowtype;
  v_pool public.arena_reward_pools%rowtype;
  v_tier public.arena_reward_tiers%rowtype;
  v_field integer;
  v_tier_total numeric(38, 6);
  v_start integer;
  v_end integer;
  v_winners integer;
  v_each numeric(38, 6);
  v_created integer := 0;
  v_allocated numeric(38, 6) := 0;
  v_reserved numeric(38, 6) := 0;
begin
  select * into v_arena from public.arenas where id = p_arena_id for update;
  if not found then raise exception 'arena_not_found'; end if;
  if v_arena.status <> 'finished' then raise exception 'arena_not_finished'; end if;

  select * into v_pool from public.arena_reward_pools where arena_id = p_arena_id for update;
  if not found then raise exception 'reward_pool_not_found'; end if;
  if not v_arena.reward_pool_enabled then raise exception 'reward_pool_disabled'; end if;
  if v_pool.status in ('cancelled', 'distributed') then raise exception 'reward_pool_closed'; end if;

  select count(*) into v_field
  from public.arena_entries
  where arena_id = p_arena_id and status = 'finished' and final_rank is not null;

  if v_field = 0 then raise exception 'no_final_standings'; end if;

  for v_tier in
    select * from public.arena_reward_tiers
    where reward_pool_id = v_pool.id
    order by position, created_at
  loop
    v_tier_total := coalesce(v_tier.amount, round(v_pool.total_amount * v_tier.percentage / 100, 6));
    if v_tier_total is null or v_tier_total <= 0 then continue; end if;

    -- supporter / community / special have no deterministic rank mapping yet.
    -- They stay reserved until a non-farmable rule exists (Phase 3 §15).
    if v_tier.reward_type in ('supporter', 'community', 'special') then
      v_reserved := v_reserved + v_tier_total;
      continue;
    end if;

    if v_tier.reward_type = 'champion' then
      v_start := 1;
      v_end := 1;
    elsif v_tier.reward_type = 'percentile' then
      v_start := greatest(1, ceil(coalesce(v_tier.percentile_start, 0) * v_field)::integer);
      v_end := least(v_field, greatest(v_start, floor(coalesce(v_tier.percentile_end, 1) * v_field)::integer));
    else
      v_start := coalesce(v_tier.rank_start, 1);
      v_end := least(coalesce(v_tier.rank_end, v_tier.rank_start, v_field), v_field);
    end if;

    if v_start > v_field or v_end < v_start then continue; end if;

    select count(*) into v_winners
    from public.arena_entries
    where arena_id = p_arena_id
      and status = 'finished'
      and final_rank between v_start and v_end;

    if v_winners = 0 then continue; end if;

    v_each := case
      when v_tier.distribution = 'each' then v_tier_total
      else round(v_tier_total / v_winners, 6)
    end;
    if v_each <= 0 then continue; end if;

    insert into public.reward_allocations (
      arena_id, project_id, builder_id, tier_id, wallet_address, reward_type, label,
      final_rank, amount, token_symbol, token_contract, chain_id, status
    )
    select
      p_arena_id,
      ae.project_id,
      ae.builder_id,
      v_tier.id,
      (select bw.wallet_address from public.builder_wallets bw
        where bw.builder_id = ae.builder_id and bw.verified_at is not null
        order by bw.is_primary desc, bw.created_at asc limit 1),
      v_tier.reward_type,
      coalesce(nullif(v_tier.label, ''), initcap(v_tier.reward_type)),
      ae.final_rank,
      v_each,
      v_pool.token_symbol,
      v_pool.token_contract,
      v_pool.chain_id,
      'pending'
    from public.arena_entries ae
    where ae.arena_id = p_arena_id
      and ae.status = 'finished'
      and ae.final_rank between v_start and v_end
      and ae.builder_id is not null
    on conflict (arena_id, project_id, tier_id) do nothing;

    get diagnostics v_winners = row_count;
    v_created := v_created + v_winners;
    v_allocated := v_allocated + (v_each * v_winners);
  end loop;

  update public.arena_reward_pools set status = 'allocated' where id = v_pool.id;

  return jsonb_build_object(
    'created', v_created,
    'allocated', v_allocated,
    'reserved', v_reserved,
    'field', v_field
  );
end;
$$;

create or replace function public.set_arena_reward_status(
  p_arena_id uuid,
  p_from text,
  p_to text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_to not in ('approved', 'claimable', 'cancelled') then raise exception 'bad_status'; end if;
  update public.reward_allocations
    set status = p_to,
        approved_at = case when p_to in ('approved', 'claimable') then coalesce(approved_at, now()) else approved_at end
    where arena_id = p_arena_id and status = p_from;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Atomic claim. Guarded so an allocation can never be claimed twice: the row is
-- locked, the status must still be 'claimable', and the payout hash is unique.
create or replace function public.claim_reward(
  p_allocation_id uuid,
  p_builder_id uuid,
  p_wallet_address text,
  p_signature text,
  p_tx_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alloc public.reward_allocations%rowtype;
begin
  select * into v_alloc from public.reward_allocations where id = p_allocation_id for update;
  if not found then raise exception 'allocation_not_found'; end if;
  if v_alloc.builder_id is distinct from p_builder_id then raise exception 'forbidden'; end if;
  if v_alloc.status = 'claimed' then raise exception 'already_claimed'; end if;
  if v_alloc.status <> 'claimable' then raise exception 'not_claimable'; end if;

  if not exists (
    select 1 from public.builder_wallets
    where builder_id = p_builder_id
      and wallet_address = lower(p_wallet_address)
      and verified_at is not null
  ) then
    raise exception 'wallet_not_verified';
  end if;

  if v_alloc.wallet_address is not null and v_alloc.wallet_address <> lower(p_wallet_address) then
    raise exception 'wallet_mismatch';
  end if;

  update public.reward_allocations
    set status = 'claimed',
        wallet_address = lower(p_wallet_address),
        claim_signature = p_signature,
        claim_tx_hash = lower(p_tx_hash),
        claimed_at = now()
    where id = p_allocation_id;

  perform public.track_event(
    'reward_claimed', null, p_builder_id, v_alloc.arena_id, v_alloc.project_id,
    jsonb_build_object('amount', v_alloc.amount::text, 'rewardType', v_alloc.reward_type)
  );

  return jsonb_build_object(
    'allocation_id', p_allocation_id,
    'amount', v_alloc.amount::text,
    'token_symbol', v_alloc.token_symbol,
    'status', 'claimed'
  );
end;
$$;

-- Attaches an on-chain payout hash to an already-claimed allocation.
create or replace function public.settle_reward_claim(
  p_allocation_id uuid,
  p_tx_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reward_allocations
    set claim_tx_hash = lower(p_tx_hash)
    where id = p_allocation_id and status = 'claimed';
end;
$$;

-- ---------------------------------------------------------------------------
-- Read models
-- ---------------------------------------------------------------------------

create or replace function public.builder_prena_summary(p_builder_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'claimable', coalesce((
      select sum(amount) from public.reward_allocations
      where builder_id = p_builder_id and status = 'claimable'
    ), 0)::text,
    'pending', coalesce((
      select sum(amount) from public.reward_allocations
      where builder_id = p_builder_id and status in ('pending', 'approved')
    ), 0)::text,
    'earned', coalesce((
      select sum(amount) from public.reward_allocations
      where builder_id = p_builder_id and status in ('claimable', 'claimed')
    ), 0)::text,
    'claimed', coalesce((
      select sum(amount) from public.reward_allocations
      where builder_id = p_builder_id and status = 'claimed'
    ), 0)::text,
    'spent', coalesce((
      select sum(token_amount::numeric / power(10::numeric, token_decimals))
      from public.token_payments
      where builder_id = p_builder_id and status = 'confirmed'
    ), 0)::text
  );
$$;

create or replace function public.prena_economy_totals()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'entryVolume', coalesce((
      select sum(token_amount::numeric / power(10::numeric, token_decimals))
      from public.token_payments where status = 'confirmed'
    ), 0)::text,
    'tokenPayments', (select count(*) from public.token_payments where status = 'confirmed'),
    'openPayments', (select count(*) from public.token_payments where status in ('pending', 'confirming')),
    'failedPayments', (select count(*) from public.token_payments where status in ('failed', 'expired')),
    'rewardsAllocated', coalesce((
      select sum(amount) from public.reward_allocations where status <> 'cancelled'
    ), 0)::text,
    'rewardsClaimed', coalesce((
      select sum(amount) from public.reward_allocations where status = 'claimed'
    ), 0)::text,
    'rewardsUnclaimed', coalesce((
      select sum(amount) from public.reward_allocations where status in ('pending', 'approved', 'claimable')
    ), 0)::text,
    'linkedWallets', (select count(*) from public.builder_wallets where verified_at is not null),
    'buildersWithWallets', (select count(distinct builder_id) from public.builder_wallets where verified_at is not null)
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS — every new table is deny-by-default; the app reads through the
-- service-role client after its own authorization checks.
-- ---------------------------------------------------------------------------

alter table public.builder_wallets enable row level security;
alter table public.wallet_nonces enable row level security;
alter table public.prena_quotes enable row level security;
alter table public.token_payments enable row level security;
alter table public.arena_reward_pools enable row level security;
alter table public.arena_reward_tiers enable row level security;
alter table public.reward_allocations enable row level security;

do $$ begin
  create policy "wallets own" on public.builder_wallets
    for select using (
      builder_id in (select id from public.builders where user_id = auth.uid())
      or public.is_admin()
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "token payments own" on public.token_payments
    for select using (
      builder_id in (select id from public.builders where user_id = auth.uid())
      or public.is_admin()
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "allocations own" on public.reward_allocations
    for select using (
      builder_id in (select id from public.builders where user_id = auth.uid())
      or public.is_admin()
    );
exception when duplicate_object then null;
end $$;

-- Reward pools and tiers are public product information for a public Arena.
do $$ begin
  create policy "reward pools public" on public.arena_reward_pools
    for select using (
      exists (
        select 1 from public.arenas a
        where a.id = arena_id and a.status <> 'draft' and a.visibility = 'public'
      )
      or public.is_admin()
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "reward tiers public" on public.arena_reward_tiers
    for select using (
      exists (
        select 1
        from public.arena_reward_pools p
        join public.arenas a on a.id = p.arena_id
        where p.id = reward_pool_id and a.status <> 'draft' and a.visibility = 'public'
      )
      or public.is_admin()
    );
exception when duplicate_object then null;
end $$;

grant select on public.prena_activity to anon, authenticated;


-- ===========================================================================
-- REWARD PUBLICATION NOTIFICATIONS (identical to migrations/005_reward_notifications.sql)
-- ===========================================================================

-- Project Arena — reward publication notifications.
-- Idempotent. Safe to re-run. Appended verbatim to supabase/schema.sql.
--
-- Rewards were allocated and approved silently: a Builder only learned about a
-- claimable allocation by opening the dashboard. Publishing is the one reward
-- transition a Builder can act on, so it is the one that queues mail.
--
-- HARD RULE UNCHANGED: this reads frozen rankings only. Nothing here writes
-- arena_entries.supporter_count / unique_visit_count / score / current_rank /
-- final_rank, or projects.arena_rating.

create or replace function public.set_arena_reward_status(
  p_arena_id uuid,
  p_from text,
  p_to text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_count integer;
  v_row record;
begin
  if p_to not in ('approved', 'claimable', 'cancelled') then raise exception 'bad_status'; end if;

  -- Collecting the ids rather than counting them keeps the notification scoped
  -- to the rows this call moved, not every allocation already claimable.
  with updated as (
    update public.reward_allocations
      set status = p_to,
          approved_at = case when p_to in ('approved', 'claimable') then coalesce(approved_at, now()) else approved_at end
      where arena_id = p_arena_id and status = p_from
      returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from updated;

  v_count := coalesce(array_length(v_ids, 1), 0);

  -- approved and cancelled are internal admin states; only claimable is news.
  -- The join drops allocations with no builder, and the guard drops builders
  -- with no address, so an unreachable winner never queues undeliverable mail.
  if p_from = 'approved' and p_to = 'claimable' then
    for v_row in
      select
        b.email as to_email,
        a.name as arena_name,
        a.slug as arena_slug,
        p.name as project_name,
        ra.amount,
        ra.token_symbol,
        coalesce(nullif(ra.label, ''), initcap(ra.reward_type)) as reward_label
      from public.reward_allocations ra
      join public.arenas a on a.id = ra.arena_id
      join public.projects p on p.id = ra.project_id
      join public.builders b on b.id = ra.builder_id
      where ra.id = any(v_ids)
        and coalesce(b.email, '') <> ''
    loop
      perform public.queue_email(
        'reward_claimable',
        v_row.to_email,
        jsonb_build_object(
          'arenaName', v_row.arena_name,
          'arenaSlug', v_row.arena_slug,
          'projectName', v_row.project_name,
          -- Text, not numeric: PostgREST would return numeric as a JavaScript
          -- number and round a large allocation in the rendered email.
          'amount', v_row.amount::text,
          'tokenSymbol', v_row.token_symbol,
          'rewardLabel', v_row.reward_label
        )
      );
    end loop;
  end if;

  return v_count;
end;
$$;


-- ===========================================================================
-- SCOUT FOUNDATION (identical to migrations/006_scout_foundation.sql)
-- ===========================================================================

-- Project Arena — Scout foundation (Phase 3 §16).
-- Idempotent. Safe to re-run. Appended verbatim to supabase/schema.sql.
--
-- SCAFFOLDING ONLY. No prediction feature is live. This migration deliberately
-- ships no function that creates a prediction, so the only way a row reaches
-- scout_predictions today is a hand-written statement. The tables exist so the
-- shape is settled before the feature is designed, not because it is enabled.
--
-- SCOUT POINTS ARE NOT MONEY, AND CANNOT BECOME MONEY. That is enforced by what
-- is absent, which erodes far more slowly than a rule in a code review:
--   * no token, wallet, chain, price, payout, or stake column exists on any
--     scout table, and assert_scout_non_monetary() below fails this migration
--     if one is ever added;
--   * no function converts points to $PRENA, and no prediction pays out of a
--     shared pot — there is no pot, so there is nothing to convert into;
--   * scout_points.builder_id is immutable, so a balance cannot be moved to
--     another Builder. Points are earned and spent only inside Project Arena;
--   * scout_predictions carries points_committed and no counterpart credit
--     column. A prediction costs points; it never buys a share of anything.
--
-- HARD RULE, same as 004: nothing here writes to
-- arena_entries.supporter_count / unique_visit_count / score / current_rank /
-- final_rank, or to projects.arena_rating. Scout activity cannot touch rank.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Balances — one row per Builder, non-transferable
-- ---------------------------------------------------------------------------

create table if not exists public.scout_points (
  builder_id uuid primary key references public.builders (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  lifetime_spent integer not null default 0 check (lifetime_spent >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrades a database that already had a bare balance row before the lifetime
-- counters existed. Both counters are monotonic: a balance can be read back to
-- zero, but "this Builder has earned points" is a fact that never un-happens.
alter table public.scout_points add column if not exists lifetime_earned integer not null default 0;
alter table public.scout_points add column if not exists lifetime_spent integer not null default 0;
alter table public.scout_points add column if not exists created_at timestamptz not null default now();

do $$ begin
  alter table public.scout_points
    add constraint scout_points_lifetime_earned_check check (lifetime_earned >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.scout_points
    add constraint scout_points_lifetime_spent_check check (lifetime_spent >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.scout_points
    add constraint scout_points_balance_check check (balance >= 0);
exception when duplicate_object then null;
end $$;

-- Reassigning the owner of a balance row is the one shape a transfer could take
-- without a dedicated transfer function. Blocked here so it cannot be reached
-- even from the service-role client, which bypasses RLS.
create or replace function public.scout_points_owner_is_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.builder_id is distinct from old.builder_id then
    raise exception 'scout_points_not_transferable';
  end if;
  return new;
end;
$$;

do $$ begin
  create trigger scout_points_owner_immutable before update of builder_id on public.scout_points
    for each row execute function public.scout_points_owner_is_immutable();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger scout_points_touch before update on public.scout_points
    for each row execute function public.touch_updated_at();
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Point events — the audit trail behind every balance
-- ---------------------------------------------------------------------------

create table if not exists public.scout_point_events (
  id uuid primary key default gen_random_uuid(),
  builder_id uuid not null references public.builders (id) on delete cascade,
  arena_id uuid references public.arenas (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  prediction_id uuid,
  -- Signed: positive awards, negative spends. Zero would be a no-op row that
  -- makes the ledger harder to read without recording anything.
  delta integer not null check (delta <> 0),
  reason text not null check (reason in (
    'arena_participation', 'discovery', 'prediction_accuracy', 'seasonal', 'admin_adjustment'
  )),
  -- Snapshot of the balance after this event, so the ledger can be audited
  -- against scout_points without replaying every row.
  balance_after integer not null check (balance_after >= 0),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scout_point_events_builder_idx
  on public.scout_point_events (builder_id, created_at desc);
create index if not exists scout_point_events_arena_idx
  on public.scout_point_events (arena_id, created_at desc);

-- Append-only. An audit trail that can be edited afterwards is not an audit
-- trail. The DELETE branch yields only when the owning Builder row is already
-- gone, which is the cascade from an account deletion — that must still work.
create or replace function public.scout_point_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.builders where id = old.builder_id) then
      return old;
    end if;
    raise exception 'scout_point_events_append_only';
  end if;
  raise exception 'scout_point_events_append_only';
end;
$$;

do $$ begin
  create trigger scout_point_events_immutable before update or delete on public.scout_point_events
    for each row execute function public.scout_point_events_append_only();
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Predictions — the shape only. Nothing writes here yet.
--
-- Read this table as "a Builder said, before the Arena started, that this
-- Project would land here". It has no counterparty, no pool, and no credit
-- column, so it cannot become a market by adding rows to it.
-- ---------------------------------------------------------------------------

create table if not exists public.scout_predictions (
  id uuid primary key default gen_random_uuid(),
  builder_id uuid not null references public.builders (id) on delete cascade,
  arena_id uuid not null references public.arenas (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Exactly one of the two: an exact finishing place, or a coarse band. Both at
  -- once would let the same call be scored twice under different rules.
  predicted_rank integer check (predicted_rank is null or predicted_rank >= 1),
  predicted_bucket text check (predicted_bucket is null or predicted_bucket in (
    'champion', 'top_3', 'top_10', 'top_25_percent', 'top_50_percent'
  )),
  -- Scout Points only. A cost, never a stake: nothing is returned, multiplied,
  -- or split from a pot when the prediction resolves. Any accuracy award is a
  -- separate scout_point_events row with reason 'prediction_accuracy'.
  points_committed integer not null default 0 check (points_committed >= 0),
  outcome text not null default 'pending'
    check (outcome in ('pending', 'correct', 'incorrect', 'void')),
  actual_rank integer check (actual_rank is null or actual_rank >= 1),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint scout_predictions_one_call check (
    (predicted_rank is null) <> (predicted_bucket is null)
  ),
  constraint scout_predictions_resolved_shape check (
    (outcome = 'pending') = (resolved_at is null)
  )
);

-- One call per Builder per Project per Arena. Without this a Builder could
-- cover every outcome, which is the first thing that turns a guess into a bet.
create unique index if not exists scout_predictions_unique
  on public.scout_predictions (builder_id, arena_id, project_id);
create index if not exists scout_predictions_builder_idx
  on public.scout_predictions (builder_id, created_at desc);
create index if not exists scout_predictions_arena_idx
  on public.scout_predictions (arena_id, outcome);

-- Declared after the table it points at. Lets a 'prediction_accuracy' event be
-- traced back to the call it settled without a second join table.
do $$ begin
  alter table public.scout_point_events
    add constraint scout_point_events_prediction_fkey
    foreign key (prediction_id) references public.scout_predictions (id) on delete set null;
exception when duplicate_object then null;
end $$;

-- A prediction made after the Arena is under way is not a prediction. Fires on
-- insert, and on any update that touches the call itself — resolution, which
-- only writes outcome / actual_rank / resolved_at, is left alone.
create or replace function public.scout_predictions_lock_on_start()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_arena public.arenas%rowtype;
begin
  select * into v_arena from public.arenas where id = new.arena_id;
  if not found then raise exception 'arena_not_found'; end if;
  if v_arena.status in ('live', 'finished', 'cancelled') then
    raise exception 'arena_already_started';
  end if;
  if now() >= v_arena.starts_at then
    raise exception 'arena_already_started';
  end if;
  return new;
end;
$$;

do $$ begin
  create trigger scout_predictions_locked
    before insert or update of arena_id, project_id, predicted_rank, predicted_bucket, points_committed
    on public.scout_predictions
    for each row execute function public.scout_predictions_lock_on_start();
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Write path — the only one. Points move through here or not at all.
-- ---------------------------------------------------------------------------

-- Awards or deducts points for one Builder and records why. The row lock plus
-- the pre-check make an overdraft impossible under concurrency; the balance >= 0
-- constraint is the backstop if this function is ever bypassed.
create or replace function public.award_scout_points(
  p_builder_id uuid,
  p_delta integer,
  p_reason text,
  p_arena_id uuid default null,
  p_project_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_event_id uuid;
begin
  if p_delta is null or p_delta = 0 then raise exception 'zero_delta'; end if;

  insert into public.scout_points (builder_id) values (p_builder_id)
    on conflict (builder_id) do nothing;

  select balance into v_balance
    from public.scout_points where builder_id = p_builder_id for update;
  if not found then raise exception 'builder_not_found'; end if;

  if v_balance + p_delta < 0 then raise exception 'insufficient_scout_points'; end if;

  update public.scout_points
    set balance = balance + p_delta,
        lifetime_earned = lifetime_earned + greatest(p_delta, 0),
        lifetime_spent = lifetime_spent + greatest(-p_delta, 0)
    where builder_id = p_builder_id
    returning balance into v_balance;

  insert into public.scout_point_events (
    builder_id, arena_id, project_id, delta, reason, balance_after, note
  ) values (
    p_builder_id, p_arena_id, p_project_id, p_delta, p_reason, v_balance, p_note
  )
  returning id into v_event_id;

  return jsonb_build_object('event_id', v_event_id, 'balance', v_balance, 'delta', p_delta);
end;
$$;

-- ---------------------------------------------------------------------------
-- Read model
-- ---------------------------------------------------------------------------

create or replace function public.builder_scout_summary(p_builder_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'balance', coalesce((
      select balance from public.scout_points where builder_id = p_builder_id
    ), 0),
    'lifetimeEarned', coalesce((
      select lifetime_earned from public.scout_points where builder_id = p_builder_id
    ), 0),
    'lifetimeSpent', coalesce((
      select lifetime_spent from public.scout_points where builder_id = p_builder_id
    ), 0),
    'events', (select count(*) from public.scout_point_events where builder_id = p_builder_id),
    'predictions', (select count(*) from public.scout_predictions where builder_id = p_builder_id),
    'predictionsCorrect', (
      select count(*) from public.scout_predictions
      where builder_id = p_builder_id and outcome = 'correct'
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Structural guard
--
-- Raises if a monetary column has appeared on a scout table. Called at the end
-- of this migration, so re-running it after someone adds token_amount or
-- wallet_address turns "Scout Points have no monetary value" from a promise in
-- a comment into a statement that fails.
-- ---------------------------------------------------------------------------

create or replace function public.assert_scout_non_monetary()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_offender text;
begin
  select c.table_name || '.' || c.column_name into v_offender
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name in ('scout_points', 'scout_point_events', 'scout_predictions')
    and c.column_name similar to
      '%(token|wallet|chain|usd|price|payout|stake|wager|odds|cash|currency|amount|payment)%'
  limit 1;

  if v_offender is not null then
    raise exception 'scout tables must stay non-monetary, found: %', v_offender;
  end if;
end;
$$;

select public.assert_scout_non_monetary();

-- ---------------------------------------------------------------------------
-- RLS — deny by default, own-row reads only. The app reads through the
-- service-role client after its own authorization checks, exactly as in 004.
-- ---------------------------------------------------------------------------

alter table public.scout_points enable row level security;
alter table public.scout_point_events enable row level security;
alter table public.scout_predictions enable row level security;

-- Dropped and recreated rather than guarded by duplicate_object: a policy that
-- already exists must converge on this definition, not silently keep an older one.
drop policy if exists "scout points own" on public.scout_points;
create policy "scout points own" on public.scout_points
  for select to authenticated using (
    builder_id in (select id from public.builders where user_id = auth.uid())
    or public.is_admin()
  );

-- Dropped and recreated rather than guarded by duplicate_object: a policy that
-- already exists must converge on this definition, not silently keep an older one.
drop policy if exists "scout events own" on public.scout_point_events;
create policy "scout events own" on public.scout_point_events
  for select to authenticated using (
    builder_id in (select id from public.builders where user_id = auth.uid())
    or public.is_admin()
  );

-- Own rows only, even after the Arena finishes: a public prediction board would
-- create exactly the social pressure this phase is meant to avoid.
-- Dropped and recreated rather than guarded by duplicate_object: a policy that
-- already exists must converge on this definition, not silently keep an older one.
drop policy if exists "scout predictions own" on public.scout_predictions;
create policy "scout predictions own" on public.scout_predictions
  for select to authenticated using (
    builder_id in (select id from public.builders where user_id = auth.uid())
    or public.is_admin()
  );


-- ===========================================================================
-- $PRENA WALLET INDEXES (identical to migrations/007_prena_indexes.sql)
-- ===========================================================================

-- Indexes for the wallet_address query patterns Phase 3 introduced.
-- Idempotent. Safe to re-run.
--
-- Both tables are queried by wallet_address and neither was indexed for it:
--   * unlinkWallet counts open payments and open rewards for an address
--   * the mock chain provider reads both on every balance lookup, and mock is
--     the default mode, so a dashboard render was seq-scanning both tables.

create index if not exists token_payments_wallet_idx
  on public.token_payments (wallet_address);

create index if not exists reward_allocations_wallet_idx
  on public.reward_allocations (wallet_address)
  where wallet_address is not null;


-- ===========================================================================
-- RPC GRANTS (identical to migrations/008_lock_service_role_rpcs.sql)
-- ===========================================================================
-- Must stay LAST in this file: it sweeps every function in public, so any
-- function created below it would keep the anon grant it was born with.
--
-- The per-function `revoke ... from public` list earlier in this file is kept
-- for the record but is not what secures these functions. It revoked only the
-- PUBLIC pseudo-role, while Supabase's default privileges on schema public
-- grant EXECUTE to anon and authenticated by name, and it never grew to cover
-- the Phase 3 / Scout functions at all.

-- Project Arena — take anon and authenticated off the service-role RPCs.
-- Idempotent. Safe to re-run.
--
-- schema.sql revokes these functions `from public`, and that was never enough.
-- Supabase ships default privileges on schema public, for BOTH the `postgres`
-- and `supabase_admin` grantors, that grant EXECUTE on every newly created
-- function to anon, authenticated and service_role. Those are explicit grants
-- to named roles, so `revoke ... from public` — which only drops the PUBLIC
-- pseudo-role — left them standing:
--
--   approve_entry        {postgres=X, anon=X, authenticated=X, service_role=X}
--   finalize_arena_by_id {postgres=X, anon=X, authenticated=X, service_role=X}
--   confirm_paid_entry   {postgres=X, anon=X, authenticated=X, service_role=X}
--
-- NEXT_PUBLIC_SUPABASE_ANON_KEY ships to every browser, and none of these
-- functions carries an internal is_admin() guard — they were written to rely on
-- the grant. So anyone could POST /rest/v1/rpc/approve_entry and approve an
-- unpaid entry, call confirm_paid_entry to manufacture a paid one, or call
-- finalize_arena_by_id to freeze a live board on a ranking they liked.
--
-- Every .rpc() call site in src/ goes through createAdminClient() (the
-- service_role key), so nothing in the app loses a capability here.
--
-- Three functions must keep caller access, because RLS policy expressions are
-- evaluated as the calling role and would otherwise fail closed for everyone:
--   is_admin()             — 17 policies
--   owns_project(uuid)     — projects read + update policies
--   slugify(text)          — retained from schema.sql
-- plus ensure_builder(), self-service and scoped to auth.uid().

-- ---------------------------------------------------------------------------
-- 1. Revoke EXECUTE on every function this project owns in public.
-- ---------------------------------------------------------------------------
-- No extension owns a function in public (extensions live in `extensions`), so
-- this cannot strip a gen_random_uuid() a column default depends on.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (
        select 1 from pg_depend d
        where d.objid = p.oid
          and d.classid = 'pg_proc'::regclass
          and d.deptype = 'e'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Re-grant the caller-facing allowlist.
-- ---------------------------------------------------------------------------

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.owns_project(uuid) to anon, authenticated;
grant execute on function public.slugify(text) to anon, authenticated;
grant execute on function public.ensure_builder() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Stop the next `create function` from re-opening the hole.
-- ---------------------------------------------------------------------------
-- Without this, migration 009 reintroduces the whole problem silently.
-- Default privileges are per-grantor; altering another role's set requires
-- membership in it, so a role we cannot alter is reported, not fatal.

do $$
declare
  grantor text;
begin
  foreach grantor in array array['postgres', 'supabase_admin']
  loop
    if not exists (select 1 from pg_roles where rolname = grantor) then
      continue;
    end if;
    begin
      execute format(
        'alter default privileges for role %I in schema public revoke execute on functions from anon, authenticated',
        grantor
      );
    exception when insufficient_privilege or invalid_grant_operation then
      raise warning
        'could not alter default privileges for role % — run this statement as that role, or new functions will keep granting EXECUTE to anon',
        grantor;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Assert the result. The migration fails rather than reporting a false pass.
-- ---------------------------------------------------------------------------

do $$
declare
  v_leaks text;
begin
  select string_agg(sig, ', ' order by sig) into v_leaks
  from (
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.oid::regprocedure::text not in (
        'is_admin()',
        'owns_project(uuid)',
        'slugify(text)',
        'ensure_builder()'
      )
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ) s;

  if v_leaks is not null then
    raise exception 'still executable by anon/authenticated: %', v_leaks;
  end if;

  -- The allowlist must survive, or every RLS policy calling it fails closed.
  if not has_function_privilege('anon', 'public.is_admin()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.owns_project(uuid)', 'EXECUTE') then
    raise exception 'RLS helper functions lost their grant';
  end if;

  -- service_role drives every RPC in src/. If it lost EXECUTE, the app is down.
  if not has_function_privilege('service_role', 'public.approve_entry(uuid)', 'EXECUTE') then
    raise exception 'service_role lost EXECUTE on approve_entry';
  end if;
end;
$$;
