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
