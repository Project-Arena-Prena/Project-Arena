-- Project Arena — Phase 1 production schema.
-- Run on a fresh Supabase project, then run supabase/seed.sql.

create extension if not exists pgcrypto;

do $$ begin
  create type public.arena_status as enum ('upcoming', 'live', 'finished');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.project_category as enum (
    'AI', 'SaaS', 'Games', 'Developer', 'Open Source', 'Design',
    'Mobile', 'Web3', 'Creator', 'Community', 'Other'
  );
exception when duplicate_object then null;
end $$;

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
  builder_email text not null,
  status text not null default 'active' check (status in ('pending', 'active', 'rejected')),
  arena_rating integer not null default 1200 check (arena_rating >= 0),
  total_supporters integer not null default 0 check (total_supporters >= 0),
  total_project_visits integer not null default 0 check (total_project_visits >= 0),
  arena_appearances integer not null default 0 check (arena_appearances >= 0),
  championships integer not null default 0 check (championships >= 0),
  highest_rank integer,
  created_at timestamptz not null default now()
);

create table if not exists public.arenas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  number integer not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.arena_status not null default 'upcoming',
  max_entries integer not null default 32 check (max_entries > 0),
  entry_price integer not null default 0 check (entry_price >= 0),
  spectators integer not null default 0 check (spectators >= 0),
  created_at timestamptz not null default now(),
  constraint arenas_valid_window check (ends_at > starts_at)
);

create table if not exists public.arena_entries (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'disqualified')),
  supporter_count integer not null default 0 check (supporter_count >= 0),
  unique_visit_count integer not null default 0 check (unique_visit_count >= 0),
  -- Phase 1 formula: 1 supporter = 1 point; 1 unique outbound visit = 2 points.
  score integer generated always as (supporter_count + (unique_visit_count * 2)) stored,
  final_rank integer,
  payment_reference text unique,
  joined_at timestamptz not null default now(),
  unique (arena_id, project_id)
);

create table if not exists public.supports (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  unique (arena_id, project_id, visitor_id)
);

create table if not exists public.outbound_visits (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid references public.arenas (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_id uuid not null,
  created_at timestamptz not null default now()
);

create unique index if not exists outbound_visits_arena_unique_idx
  on public.outbound_visits (arena_id, project_id, visitor_id)
  where arena_id is not null;
create unique index if not exists outbound_visits_profile_unique_idx
  on public.outbound_visits (project_id, visitor_id)
  where arena_id is null;
create index if not exists arena_entries_score_idx
  on public.arena_entries (arena_id, score desc, supporter_count desc);
create index if not exists arena_entries_project_idx on public.arena_entries (project_id);
create index if not exists supports_project_idx on public.supports (arena_id, project_id);
create index if not exists outbound_visits_project_idx on public.outbound_visits (arena_id, project_id);

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
  ae.score,
  ae.final_rank,
  rank() over (
    partition by ae.arena_id
    order by ae.score desc, ae.supporter_count desc, ae.joined_at asc
  ) as rank,
  round(100.0 * ae.score / nullif(sum(ae.score) over (partition by ae.arena_id), 0), 1) as score_share
from public.arena_entries ae
join public.projects p on p.id = ae.project_id
join public.arenas a on a.id = ae.arena_id
where ae.status = 'confirmed' and p.status = 'active';

alter table public.projects enable row level security;
alter table public.arenas enable row level security;
alter table public.arena_entries enable row level security;
alter table public.supports enable row level security;
alter table public.outbound_visits enable row level security;

drop policy if exists "active projects are public" on public.projects;
create policy "active projects are public" on public.projects
  for select to anon, authenticated using (status = 'active');
drop policy if exists "arenas are public" on public.arenas;
create policy "arenas are public" on public.arenas
  for select to anon, authenticated using (true);
drop policy if exists "confirmed entries are public" on public.arena_entries;
create policy "confirmed entries are public" on public.arena_entries
  for select to anon, authenticated using (status = 'confirmed');

grant usage on schema public to anon, authenticated;
revoke all on public.projects, public.arenas, public.arena_entries,
  public.supports, public.outbound_visits from anon, authenticated;
grant select (
  id, name, slug, tagline, description, logo_url, website_url, x_url, github_url,
  category, status, arena_rating, total_supporters, total_project_visits,
  arena_appearances, championships, highest_rank, created_at
) on public.projects to anon, authenticated;
grant select on public.arenas, public.arena_entries, public.arena_standings to anon, authenticated;

create or replace function public.slugify(p_text text)
returns text language sql immutable set search_path = '' as $$
  select nullif(trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g')), '');
$$;

create or replace function public.record_support(
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
  v_inserted integer;
begin
  select a.id, p.id, ae.id
    into v_arena_id, v_project_id, v_entry_id
  from public.arena_entries ae
  join public.arenas a on a.id = ae.arena_id
  join public.projects p on p.id = ae.project_id
  where a.slug = p_arena_slug
    and p.slug = p_project_slug
    and a.status = 'live'
    and ae.status = 'confirmed';

  if v_entry_id is null then
    raise exception 'project is not competing in this live Arena';
  end if;

  insert into public.supports (arena_id, project_id, visitor_id)
  values (v_arena_id, v_project_id, p_visitor_id)
  on conflict (arena_id, project_id, visitor_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return jsonb_build_object('duplicate', true);
  end if;

  update public.arena_entries
    set supporter_count = supporter_count + 1
    where id = v_entry_id;
  update public.projects
    set total_supporters = total_supporters + 1
    where id = v_project_id;

  return jsonb_build_object('duplicate', false);
end;
$$;

create or replace function public.record_outbound_visit(
  p_project_slug text,
  p_arena_slug text default null,
  p_visitor_id uuid default null
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
      and ae.status = 'confirmed';
  end if;

  insert into public.outbound_visits (arena_id, project_id, visitor_id)
  values (v_arena_id, v_project_id, p_visitor_id)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return jsonb_build_object('duplicate', true); end if;

  update public.projects
    set total_project_visits = total_project_visits + 1
    where id = v_project_id;
  if v_entry_id is not null then
    update public.arena_entries
      set unique_visit_count = unique_visit_count + 1
      where id = v_entry_id;
  end if;

  return jsonb_build_object('duplicate', false);
end;
$$;

create or replace function public.create_paid_entry(
  p_arena_slug text,
  p_project_name text,
  p_project_url text,
  p_tagline text,
  p_category text,
  p_description text,
  p_logo_url text,
  p_x_url text,
  p_github_url text,
  p_email text,
  p_stripe_session_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arena_id uuid;
  v_project_id uuid;
  v_entry_id uuid;
  v_slug text;
  v_count integer;
begin
  select id into v_entry_id from public.arena_entries where payment_reference = p_stripe_session_id;
  if v_entry_id is not null then return v_entry_id; end if;

  select id into v_arena_id from public.arenas
  where slug = p_arena_slug and status in ('upcoming', 'live');
  if v_arena_id is null then raise exception 'Arena is not open for entries'; end if;

  select count(*) into v_count from public.arena_entries
  where arena_id = v_arena_id and status = 'confirmed';
  if v_count >= (select max_entries from public.arenas where id = v_arena_id) then
    raise exception 'Arena is full';
  end if;

  v_slug := public.slugify(p_project_name);
  if exists (select 1 from public.projects where slug = v_slug and lower(builder_email) <> lower(p_email)) then
    v_slug := v_slug || '-' || substr(md5(p_stripe_session_id), 1, 5);
  end if;

  insert into public.projects (
    name, slug, tagline, description, logo_url, website_url, x_url, github_url,
    category, builder_email, status
  ) values (
    p_project_name, v_slug, p_tagline, coalesce(p_description, ''), nullif(p_logo_url, ''),
    p_project_url, nullif(p_x_url, ''), nullif(p_github_url, ''),
    case when p_category = any(enum_range(null::public.project_category)::text[])
      then p_category::public.project_category else 'Other'::public.project_category end,
    lower(p_email), 'active'
  )
  on conflict (slug) do update set
    tagline = excluded.tagline,
    description = excluded.description,
    logo_url = coalesce(excluded.logo_url, projects.logo_url),
    website_url = excluded.website_url,
    x_url = excluded.x_url,
    github_url = excluded.github_url,
    category = excluded.category
  where lower(projects.builder_email) = lower(excluded.builder_email)
  returning id into v_project_id;

  if v_project_id is null then raise exception 'Project slug belongs to another Builder'; end if;

  insert into public.arena_entries (arena_id, project_id, status, payment_reference)
  values (v_arena_id, v_project_id, 'confirmed', p_stripe_session_id)
  on conflict (arena_id, project_id) do update
    set status = 'confirmed', payment_reference = excluded.payment_reference
  returning id into v_entry_id;
  return v_entry_id;
end;
$$;

create or replace function public.finalize_arena(p_arena_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arena_id uuid;
begin
  select id into v_arena_id from public.arenas where slug = p_arena_slug and status <> 'finished';
  if v_arena_id is null then return; end if;

  update public.arena_entries ae set final_rank = ranked.rank
  from (
    select id, rank() over (order by score desc, supporter_count desc, joined_at asc)::integer as rank
    from public.arena_entries where arena_id = v_arena_id and status = 'confirmed'
  ) ranked where ae.id = ranked.id;

  update public.projects p set
    arena_appearances = arena_appearances + 1,
    championships = championships + case when ae.final_rank = 1 then 1 else 0 end,
    highest_rank = least(coalesce(highest_rank, ae.final_rank), ae.final_rank),
    arena_rating = greatest(100, arena_rating + case
      when ae.final_rank = 1 then 32 when ae.final_rank <= 3 then 20
      when ae.final_rank <= 8 then 8 else -4 end)
  from public.arena_entries ae
  where ae.project_id = p.id and ae.arena_id = v_arena_id and ae.status = 'confirmed';

  update public.arenas set status = 'finished' where id = v_arena_id;
end;
$$;

revoke all on function public.record_support(text, text, uuid) from public;
revoke all on function public.record_outbound_visit(text, text, uuid) from public;
revoke all on function public.create_paid_entry(text, text, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.finalize_arena(text) from public;
grant execute on function public.record_support(text, text, uuid) to service_role;
grant execute on function public.record_outbound_visit(text, text, uuid) to service_role;
grant execute on function public.create_paid_entry(text, text, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.finalize_arena(text) to service_role;
