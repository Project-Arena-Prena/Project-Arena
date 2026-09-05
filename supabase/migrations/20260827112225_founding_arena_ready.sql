-- Founding Arena: immutable results, lifecycle audit trail, and normalized attribution.
-- This migration is additive and safe for the existing manually-baselined project.

create table if not exists public.arena_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas (id) on delete cascade,
  from_phase text,
  to_phase text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists arena_lifecycle_events_arena_idx
  on public.arena_lifecycle_events (arena_id, created_at desc);

-- `status` remains the compatibility-facing state used by the current UI.
-- `lifecycle_phase` is the authoritative Founding Arena state machine.
alter table public.arenas
  add column if not exists lifecycle_phase text;

update public.arenas
set lifecycle_phase = case
  when status = 'draft' then 'draft'
  when status in ('registration', 'full') then 'open'
  when status = 'live' then 'live'
  when status = 'finished' then 'completed'
  when status = 'cancelled' then 'cancelled'
  else 'draft'
end
where lifecycle_phase is null;

alter table public.arenas
  alter column lifecycle_phase set default 'draft';

alter table public.arenas
  alter column lifecycle_phase set not null;

alter table public.arenas
  drop constraint if exists arenas_lifecycle_phase_check;

alter table public.arenas
  add constraint arenas_lifecycle_phase_check
  check (lifecycle_phase in ('draft', 'open', 'entry_closed', 'live', 'finalizing', 'completed', 'cancelled'));

create table if not exists public.arena_results (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas (id) on delete restrict,
  project_id uuid not null references public.projects (id) on delete restrict,
  final_rank integer not null check (final_rank > 0),
  field_size integer not null check (field_size > 0),
  score integer not null check (score >= 0),
  supporter_count integer not null check (supporter_count >= 0),
  qualified_visit_count integer not null check (qualified_visit_count >= 0),
  impression_count integer not null check (impression_count >= 0),
  rating_before integer,
  rating_delta integer,
  rating_after integer,
  finalized_at timestamptz not null default now(),
  unique (arena_id, project_id)
);

-- Historical Arenas used competition ranking, so exact ties legitimately share
-- a final rank. Future finalization uses the total ordering below, but the
-- immutable backfill must preserve already-published results without rewriting
-- their ranks or Champion.

create index if not exists arena_results_project_idx
  on public.arena_results (project_id, finalized_at desc);
create index if not exists arena_results_arena_rank_idx
  on public.arena_results (arena_id, final_rank);

create table if not exists public.arena_result_corrections (
  id uuid primary key default gen_random_uuid(),
  arena_result_id uuid not null references public.arena_results (id) on delete restrict,
  previous_result jsonb not null,
  corrected_result jsonb not null,
  reason text not null check (char_length(reason) between 3 and 500),
  corrected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.analytics_events
  add column if not exists session_id text,
  add column if not exists referrer text,
  add column if not exists source text,
  add column if not exists medium text,
  add column if not exists campaign text;

alter table public.outbound_visits
  add column if not exists qualification_version text not null default 'v1',
  add column if not exists qualified_at timestamptz;

update public.outbound_visits
set qualified_at = created_at
where is_valid and qualified_at is null;

create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id, created_at desc)
  where session_id is not null;
create index if not exists outbound_visits_qualified_idx
  on public.outbound_visits (arena_id, project_id, qualified_at desc)
  where is_valid;

create or replace function public.capture_arena_lifecycle_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.lifecycle_phase is distinct from new.lifecycle_phase then
    insert into public.arena_lifecycle_events (arena_id, from_phase, to_phase, reason)
    values (new.id, old.lifecycle_phase, new.lifecycle_phase, 'server_transition');
  end if;
  return new;
end;
$$;

drop trigger if exists arenas_capture_lifecycle_event on public.arenas;
create trigger arenas_capture_lifecycle_event
  after update of lifecycle_phase on public.arenas
  for each row execute function public.capture_arena_lifecycle_event();

create or replace function public.capture_arena_results()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_field_size integer;
begin
  if new.lifecycle_phase <> 'completed' or old.lifecycle_phase = 'completed' then
    return new;
  end if;

  select count(*) into v_field_size
  from public.arena_entries
  where arena_id = new.id and status = 'finished';

  insert into public.arena_results (
    arena_id, project_id, final_rank, field_size, score, supporter_count,
    qualified_visit_count, impression_count, rating_before, rating_delta, rating_after, finalized_at
  )
  select
    ae.arena_id, ae.project_id, ae.final_rank, v_field_size, ae.score,
    ae.supporter_count, ae.unique_visit_count, ae.impression_count,
    rh.rating_before, rh.rating_change, rh.rating_after, now()
  from public.arena_entries ae
  left join public.arena_rating_history rh
    on rh.arena_id = ae.arena_id and rh.project_id = ae.project_id
  where ae.arena_id = new.id
    and ae.status = 'finished'
    and ae.final_rank is not null
  on conflict (arena_id, project_id) do nothing;

  return new;
end;
$$;

drop trigger if exists arenas_capture_results on public.arenas;
create trigger arenas_capture_results
  after update of lifecycle_phase on public.arenas
  for each row execute function public.capture_arena_results();

create or replace function public.prevent_arena_result_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.arena_result_correction', true) <> 'true' then
    raise exception 'arena results are immutable; use an authorized correction';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists arena_results_immutable on public.arena_results;
create trigger arena_results_immutable
  before update or delete on public.arena_results
  for each row execute function public.prevent_arena_result_mutation();

create or replace function public.correct_arena_result(
  p_result_id uuid,
  p_final_rank integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;
  if p_final_rank < 1 then
    raise exception 'invalid_rank';
  end if;
  select to_jsonb(r.*) into v_before from public.arena_results r where r.id = p_result_id for update;
  if v_before is null then raise exception 'result_not_found'; end if;
  perform set_config('app.arena_result_correction', 'true', true);
  update public.arena_results set final_rank = p_final_rank where id = p_result_id;
  select to_jsonb(r.*) into v_after from public.arena_results r where r.id = p_result_id;
  insert into public.arena_result_corrections (arena_result_id, previous_result, corrected_result, reason, corrected_by)
  values (p_result_id, v_before, v_after, p_reason, auth.uid());
end;
$$;

-- Explicit lifecycle actions are server-only; reconciliation and operator routes
-- can safely retry them. Current status values remain compatible with existing UI.
create or replace function public.open_arena(p_arena_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.arenas
  set status = 'registration', lifecycle_phase = 'open'
  where id = p_arena_id and lifecycle_phase = 'draft';
end;
$$;

create or replace function public.close_arena_entries(p_arena_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.arenas
  set lifecycle_phase = 'entry_closed'
  where id = p_arena_id and lifecycle_phase = 'open';
end;
$$;

-- Finalization runs under the existing idempotent function. The phase records
-- its progress and the result trigger freezes the public record.
create or replace function public.finalize_arena_with_results(p_arena_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.arenas set lifecycle_phase = 'finalizing'
  where id = p_arena_id and lifecycle_phase = 'live';
  perform public.finalize_arena_by_id(p_arena_id);
  update public.arenas set lifecycle_phase = 'completed'
  where id = p_arena_id and status = 'finished' and lifecycle_phase <> 'completed';
end;
$$;

-- Override the legacy finalizer with a total ordering. `rank()` could produce
-- more than one #1 for an exact tie, leaving Champion selection nondeterministic.
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
  if not found or v_arena.status in ('finished', 'cancelled') then return; end if;

  update public.arenas set lifecycle_phase = 'finalizing'
  where id = p_arena_id and lifecycle_phase = 'live';

  perform public.refresh_current_ranks(p_arena_id);

  update public.arena_entries ae
  set final_rank = ranked.rank,
      current_rank = ranked.rank,
      status = 'finished'
  from (
    select id, row_number() over (order by score desc, supporter_count desc, joined_at asc, id asc)::integer as rank
    from public.arena_entries
    where arena_id = p_arena_id and status = 'competing'
  ) ranked
  where ae.id = ranked.id;

  select count(*) into v_field
  from public.arena_entries
  where arena_id = p_arena_id and status = 'finished';

  select project_id into v_champion
  from public.arena_entries
  where arena_id = p_arena_id and status = 'finished'
  order by final_rank asc, project_id asc
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
  join public.arena_rating_history h on h.project_id = ae.project_id and h.arena_id = ae.arena_id
  where ae.project_id = p.id and ae.arena_id = p_arena_id and ae.status = 'finished';

  update public.arenas
    set status = 'finished', champion_project_id = v_champion, lifecycle_phase = 'completed'
  where id = p_arena_id;

  perform public.snapshot_ranks(p_arena_id, 'final');

  insert into public.email_outbox (template, to_email, payload)
  select
    'arena_finished', b.email,
    jsonb_build_object('arenaName', v_arena.name, 'projectName', p.name, 'arenaSlug', v_arena.slug,
      'rank', ae.final_rank, 'field', v_field, 'projectSlug', p.slug)
  from public.arena_entries ae
  join public.builders b on b.id = ae.builder_id
  join public.projects p on p.id = ae.project_id
  where ae.arena_id = p_arena_id and ae.status = 'finished';
end;
$$;

create or replace function public.reconcile_founding_arenas()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_result jsonb;
begin
  -- Preserve the established, row-locking lifecycle engine, then mirror its
  -- compatibility status into the explicit Founding Arena phases.
  v_result := public.reconcile_arenas();

  update public.arenas set lifecycle_phase = 'open'
  where status in ('registration', 'full') and lifecycle_phase = 'draft';

  for r in
    select id from public.arenas
    where lifecycle_phase = 'open'
      and registration_closes_at is not null
      and registration_closes_at <= now()
  loop
    perform public.close_arena_entries(r.id);
  end loop;

  update public.arenas set lifecycle_phase = 'live'
  where status = 'live' and lifecycle_phase in ('open', 'entry_closed');

  update public.arenas set lifecycle_phase = 'completed'
  where status = 'finished' and lifecycle_phase <> 'completed';

  return v_result;
end;
$$;

-- A late payment may still be recorded for refund handling, but it can never
-- become a competing Arena Entry after the registration window closes.
create or replace function public.guard_entry_approval_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phase text;
  v_closes_at timestamptz;
begin
  if old.status <> 'pending_review' or new.status not in ('approved', 'competing') then
    return new;
  end if;
  select lifecycle_phase, registration_closes_at into v_phase, v_closes_at
  from public.arenas where id = new.arena_id;
  if v_phase <> 'open' or (v_closes_at is not null and v_closes_at <= now()) then
    raise exception 'arena_entry_window_closed';
  end if;
  return new;
end;
$$;

drop trigger if exists arena_entries_guard_approval_window on public.arena_entries;
create trigger arena_entries_guard_approval_window
  before update of status on public.arena_entries
  for each row execute function public.guard_entry_approval_window();

-- Backfill immutable records for Arenas finished before this migration.
update public.arenas set lifecycle_phase = 'completed'
where status = 'finished' and lifecycle_phase <> 'completed';

alter table public.arena_lifecycle_events enable row level security;
alter table public.arena_results enable row level security;
alter table public.arena_result_corrections enable row level security;

drop policy if exists "arena results public" on public.arena_results;
create policy "arena results public" on public.arena_results for select using (true);

revoke all on public.arena_lifecycle_events, public.arena_result_corrections from anon, authenticated;
revoke all on function public.open_arena(uuid) from public;
revoke all on function public.close_arena_entries(uuid) from public;
revoke all on function public.finalize_arena_with_results(uuid) from public;
revoke all on function public.reconcile_founding_arenas() from public;
revoke all on function public.correct_arena_result(uuid, integer, text) from public;
grant execute on function public.open_arena(uuid) to service_role;
grant execute on function public.close_arena_entries(uuid) to service_role;
grant execute on function public.finalize_arena_with_results(uuid) to service_role;
grant execute on function public.reconcile_founding_arenas() to service_role;
grant execute on function public.correct_arena_result(uuid, integer, text) to authenticated, service_role;

