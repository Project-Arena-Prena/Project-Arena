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
