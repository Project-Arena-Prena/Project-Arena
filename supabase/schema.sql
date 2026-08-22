-- Project Arena — production schema.
-- Run once against a fresh Supabase project (SQL Editor or `psql`), then supabase/seed.sql.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------- enums

do $$ begin
  create type arena_status as enum ('upcoming', 'live', 'ended');
exception when duplicate_object then null;
end $$;

-- Mirrors PROJECT_CATEGORIES in src/lib/types.ts, value for value.
do $$ begin
  create type project_category as enum (
    'AI', 'SaaS', 'Game', 'Mobile', 'Open Source', 'Dev Tool',
    'Design', 'Web3', 'Creator', 'Community', 'Experiment'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- tables

create table if not exists public.builders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete cascade,
  handle citext not null unique,
  display_name text not null,
  avatar_url text,
  -- Set by the Stripe webhook, which knows an email but no auth user. Never granted to anon.
  contact_email citext unique,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  url text not null,
  category project_category not null default 'Experiment',
  logo_url text,
  builder_id uuid references public.builders (id) on delete set null,
  arena_rating int not null default 1200,
  appearances int not null default 0,
  wins int not null default 0,
  podiums int not null default 0,
  total_supporters int not null default 0,
  total_clicks int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.arenas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  number int not null,
  name text not null,
  theme text not null default '',
  status arena_status not null default 'upcoming',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  entry_fee_cents int not null default 0,
  entrant_cap int not null default 48,
  spectators int not null default 0,
  visits int not null default 0,
  prize text not null default '',
  created_at timestamptz not null default now(),
  constraint arenas_window_check check (ends_at > starts_at)
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  -- True once entry is confirmed: Stripe paid, or a zero-fee Arena. Pending rows never reach a board.
  paid boolean not null default false,
  stripe_session_id text unique,
  supporters int not null default 0,
  clicks int not null default 0,
  score int generated always as (supporters * 3 + clicks) stored,
  final_rank int,
  created_at timestamptz not null default now(),
  unique (arena_id, project_id)
);

create table if not exists public.supports (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  visitor_hash text not null,
  created_at timestamptz not null default now(),
  unique (entry_id, visitor_hash)
);

create table if not exists public.clicks (
  id uuid primary key default gen_random_uuid(),
  -- Null when a Project is clicked outside an Arena context (profile page).
  entry_id uuid references public.entries (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_hash text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes

create index if not exists entries_arena_score_idx on public.entries (arena_id, score desc);
create index if not exists entries_project_idx on public.entries (project_id);
create index if not exists projects_slug_idx on public.projects (slug);
create index if not exists arenas_slug_idx on public.arenas (slug);
create index if not exists arenas_status_idx on public.arenas (status);
create index if not exists clicks_entry_idx on public.clicks (entry_id);

-- ---------------------------------------------------------------- standings view

create or replace view public.arena_standings as
select
  e.id as entry_id,
  e.arena_id,
  a.slug as arena_slug,
  a.status as arena_status,
  e.project_id,
  p.slug as project_slug,
  p.name as project_name,
  p.tagline,
  p.url,
  p.category,
  p.logo_url,
  p.arena_rating,
  p.builder_id,
  e.supporters,
  e.clicks,
  e.score,
  e.final_rank,
  rank() over (partition by e.arena_id order by e.score desc, e.supporters desc) as rank,
  round(100.0 * e.score / nullif(sum(e.score) over (partition by e.arena_id), 0), 1) as share
from public.entries e
join public.projects p on p.id = e.project_id
join public.arenas a on a.id = e.arena_id
where e.paid;

-- Views are not RLS targets; security_invoker makes the base-table policies apply to the caller.
alter view public.arena_standings set (security_invoker = on);

-- ---------------------------------------------------------------- row level security

alter table public.builders enable row level security;
alter table public.projects enable row level security;
alter table public.arenas  enable row level security;
alter table public.entries enable row level security;
alter table public.supports enable row level security;
alter table public.clicks  enable row level security;

drop policy if exists "builders are public" on public.builders;
create policy "builders are public"
  on public.builders for select
  using (true);

drop policy if exists "builders insert own row" on public.builders;
create policy "builders insert own row"
  on public.builders for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "builders update own row" on public.builders;
create policy "builders update own row"
  on public.builders for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "projects are public" on public.projects;
create policy "projects are public"
  on public.projects for select
  using (true);

drop policy if exists "builders insert own projects" on public.projects;
create policy "builders insert own projects"
  on public.projects for insert to authenticated
  with check (
    exists (select 1 from public.builders b where b.id = projects.builder_id and b.user_id = auth.uid())
  );

drop policy if exists "builders update own projects" on public.projects;
create policy "builders update own projects"
  on public.projects for update to authenticated
  using (
    exists (select 1 from public.builders b where b.id = projects.builder_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.builders b where b.id = projects.builder_id and b.user_id = auth.uid())
  );

drop policy if exists "arenas are public" on public.arenas;
create policy "arenas are public"
  on public.arenas for select
  using (true);

drop policy if exists "entries are public" on public.entries;
create policy "entries are public"
  on public.entries for select
  using (true);

-- Raw signal is write-only to the public: anyone may add one, nobody may read the log.
-- The service role bypasses RLS and remains the only reader.
drop policy if exists "anyone may support" on public.supports;
create policy "anyone may support"
  on public.supports for insert to anon, authenticated
  with check (true);

drop policy if exists "anyone may click" on public.clicks;
create policy "anyone may click"
  on public.clicks for insert to anon, authenticated
  with check (true);

-- ---------------------------------------------------------------- grants

grant usage on schema public to anon, authenticated;

-- Supabase grants every new public table to anon/authenticated by default. Reset, then
-- re-grant exactly what each role needs — RLS gates rows, these gate tables and columns.
revoke all on public.builders, public.projects, public.arenas,
              public.entries, public.supports, public.clicks
  from anon, authenticated;

grant select on public.projects, public.arenas, public.entries, public.arena_standings to anon, authenticated;
-- Column list is what keeps contact_email out of every public read.
grant select (id, user_id, handle, display_name, avatar_url, created_at) on public.builders to anon, authenticated;
grant insert on public.supports, public.clicks to anon, authenticated;
grant insert, update on public.projects to authenticated;
grant insert (user_id, handle, display_name, avatar_url) on public.builders to authenticated;
grant update (handle, display_name, avatar_url) on public.builders to authenticated;

-- ---------------------------------------------------------------- helpers

create or replace function public.slugify(p_text text)
returns text
language sql
immutable
as $$
  select nullif(trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g')), '');
$$;

-- One identity per signed-in user, else per caller IP. Coarse on purpose: it exists to
-- stop trivial double-counting, not to fingerprint anyone.
create or replace function public.visitor_hash()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select md5(coalesce(
    auth.uid()::text,
    nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for',
    'anonymous'
  ));
$$;

-- ---------------------------------------------------------------- rpc: POST /api/support

create or replace function public.record_support(p_project_slug text, p_arena_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_project_id uuid;
  v_rows int;
begin
  select e.id, e.project_id
    into v_entry_id, v_project_id
  from public.entries e
  join public.projects p on p.id = e.project_id
  join public.arenas a on a.id = e.arena_id
  where p.slug = p_project_slug
    and a.slug = p_arena_slug
    and a.status = 'live'
    and e.paid;

  if v_entry_id is null then
    raise exception 'no live entry for project % in arena %', p_project_slug, p_arena_slug;
  end if;

  insert into public.supports (entry_id, visitor_hash)
  values (v_entry_id, public.visitor_hash())
  on conflict (entry_id, visitor_hash) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return; -- already supported; counters stay put
  end if;

  update public.entries set supporters = supporters + 1 where id = v_entry_id;
  update public.projects set total_supporters = total_supporters + 1 where id = v_project_id;
end;
$$;

-- ---------------------------------------------------------------- rpc: POST /api/click

create or replace function public.record_click(p_project_slug text, p_arena_slug text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_entry_id uuid;
  v_arena_id uuid;
begin
  select id into v_project_id from public.projects where slug = p_project_slug;

  if v_project_id is null then
    raise exception 'unknown project %', p_project_slug;
  end if;

  if p_arena_slug is not null then
    select e.id, e.arena_id
      into v_entry_id, v_arena_id
    from public.entries e
    join public.arenas a on a.id = e.arena_id
    where e.project_id = v_project_id and a.slug = p_arena_slug and e.paid;
  end if;

  -- Clicks are not deduplicated: every outbound visit counts.
  insert into public.clicks (entry_id, project_id, visitor_hash)
  values (v_entry_id, v_project_id, public.visitor_hash());

  update public.projects set total_clicks = total_clicks + 1 where id = v_project_id;

  if v_entry_id is not null then
    update public.entries set clicks = clicks + 1 where id = v_entry_id;
    update public.arenas set visits = visits + 1 where id = v_arena_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------- rpc: POST /api/stripe/webhook

create or replace function public.create_paid_entry(
  p_arena_slug text,
  p_project_name text,
  p_project_url text,
  p_tagline text,
  p_category text,
  p_description text,
  p_email text,
  p_stripe_session_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_arena_id uuid;
  v_status arena_status;
  v_cap int;
  v_entrants int;
  v_builder_id uuid;
  v_handle text;
  v_project_id uuid;
  v_slug text;
  v_category project_category;
begin
  -- Idempotent: Stripe redelivers checkout.session.completed on any non-2xx.
  select id into v_entry_id from public.entries where stripe_session_id = p_stripe_session_id;
  if v_entry_id is not null then
    return v_entry_id;
  end if;

  select id, status, entrant_cap into v_arena_id, v_status, v_cap
  from public.arenas where slug = p_arena_slug;

  if v_arena_id is null then
    raise exception 'unknown arena %', p_arena_slug;
  end if;
  if v_status = 'ended' then
    raise exception 'arena % has ended', p_arena_slug;
  end if;

  select count(*) into v_entrants from public.entries where arena_id = v_arena_id and paid;
  if v_entrants >= v_cap then
    raise exception 'arena % is full', p_arena_slug;
  end if;

  v_category := case
    when p_category = any (enum_range(null::project_category)::text[]) then p_category::project_category
    else 'Experiment'::project_category
  end;

  v_slug := public.slugify(p_project_name);
  if v_slug is null then
    raise exception 'project name % produces no slug', p_project_name;
  end if;

  if coalesce(p_email, '') <> '' then
    select id into v_builder_id from public.builders where contact_email = lower(p_email);

    if v_builder_id is null then
      v_handle := coalesce(public.slugify(split_part(p_email, '@', 1)), 'builder');
      if exists (select 1 from public.builders where handle = v_handle) then
        v_handle := v_handle || '-' || substr(md5(lower(p_email)), 1, 4);
      end if;

      insert into public.builders (handle, display_name, contact_email)
      values (v_handle, initcap(replace(v_handle, '-', ' ')), lower(p_email))
      returning id into v_builder_id;
    end if;
  end if;

  insert into public.projects (slug, name, tagline, description, url, category, builder_id)
  values (v_slug, p_project_name, coalesce(p_tagline, ''), coalesce(p_description, ''), p_project_url, v_category, v_builder_id)
  on conflict (slug) do update
    set name = excluded.name,
        tagline = excluded.tagline,
        description = case when excluded.description = '' then projects.description else excluded.description end,
        url = excluded.url,
        category = excluded.category
    where projects.builder_id is not distinct from excluded.builder_id
  returning id into v_project_id;

  if v_project_id is null then
    -- Slug already belongs to another Builder: mint a distinct one rather than overwrite.
    v_slug := v_slug || '-' || substr(md5(p_stripe_session_id), 1, 4);
    insert into public.projects (slug, name, tagline, description, url, category, builder_id)
    values (v_slug, p_project_name, coalesce(p_tagline, ''), coalesce(p_description, ''), p_project_url, v_category, v_builder_id)
    returning id into v_project_id;
  end if;

  insert into public.entries (arena_id, project_id, paid, stripe_session_id)
  values (v_arena_id, v_project_id, true, p_stripe_session_id)
  on conflict (arena_id, project_id) do update
    set paid = true,
        stripe_session_id = coalesce(entries.stripe_session_id, excluded.stripe_session_id)
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

-- ---------------------------------------------------------------- rpc: close an Arena

create or replace function public.finalize_arena(p_arena_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_arena_id uuid;
  v_status arena_status;
  v_entrants int;
  v_delta int;
  r record;
begin
  select id, status into v_arena_id, v_status from public.arenas where slug = p_arena_slug;

  if v_arena_id is null then
    raise exception 'unknown arena %', p_arena_slug;
  end if;
  if v_status = 'ended' then
    return; -- already settled; ratings must never be applied twice
  end if;

  select count(*) into v_entrants from public.entries where arena_id = v_arena_id and paid;

  if v_entrants = 0 then
    update public.arenas set status = 'ended' where id = v_arena_id;
    return;
  end if;

  update public.entries e
     set final_rank = s.rank
    from (
      select id, rank() over (order by score desc, supporters desc) as rank
      from public.entries
      where arena_id = v_arena_id and paid
    ) s
   where e.id = s.id;

  for r in
    select project_id, final_rank
    from public.entries
    where arena_id = v_arena_id and paid
  loop
    -- Elo-ish: finishing mid-field is par, so the delta runs +32 (first) to -32 (last).
    v_delta := round(
      64 * (coalesce((v_entrants - r.final_rank)::numeric / nullif(v_entrants - 1, 0), 1) - 0.5)
    );

    update public.projects
       set appearances = appearances + 1,
           wins = wins + (case when r.final_rank = 1 then 1 else 0 end),
           podiums = podiums + (case when r.final_rank <= 3 then 1 else 0 end),
           arena_rating = greatest(100, arena_rating + v_delta)
     where id = r.project_id;
  end loop;

  update public.arenas set status = 'ended' where id = v_arena_id;
end;
$$;

-- ---------------------------------------------------------------- function grants

revoke all on function public.record_support(text, text) from public;
revoke all on function public.record_click(text, text) from public;
revoke all on function public.create_paid_entry(text, text, text, text, text, text, text, text) from public;
revoke all on function public.finalize_arena(text) from public;
revoke all on function public.visitor_hash() from public;
revoke all on function public.slugify(text) from public;

grant execute on function public.record_support(text, text) to anon, authenticated;
grant execute on function public.record_click(text, text) to anon, authenticated;
grant execute on function public.slugify(text) to anon, authenticated;

-- Money and results: service role only, reached from the Stripe webhook and scheduled jobs.
grant execute on function public.create_paid_entry(text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.finalize_arena(text) to service_role;
grant execute on function public.visitor_hash() to service_role;
