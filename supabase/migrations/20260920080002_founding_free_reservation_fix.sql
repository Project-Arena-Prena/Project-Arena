-- Reserve the ten Founding free entries atomically before payment. A rejected
-- reservation is released, and paid entries cannot be approved ahead of the
-- first ten free approvals.

create table if not exists public.founding_free_entry_allocations (
  slot smallint primary key check (slot between 1 and 10),
  arena_id uuid not null references public.arenas (id) on delete cascade,
  entry_id uuid not null unique references public.arena_entries (id) on delete cascade,
  allocated_at timestamptz not null default now()
);

alter table public.founding_free_entry_allocations enable row level security;
revoke all on public.founding_free_entry_allocations from public, anon, authenticated;
grant select, insert, delete on public.founding_free_entry_allocations to service_role;

-- Preserve at most ten allocations if the earlier boolean-only migration ran.
insert into public.founding_free_entry_allocations (slot, arena_id, entry_id, allocated_at)
select ranked.slot, ranked.arena_id, ranked.id, coalesce(ranked.approved_at, ranked.created_at, now())
from (
  select
    ae.id,
    ae.arena_id,
    ae.approved_at,
    ae.created_at,
    row_number() over (
      order by coalesce(ae.approved_at, ae.created_at), ae.created_at, ae.id
    )::smallint as slot
  from public.arena_entries ae
  join public.arenas a on a.id = ae.arena_id
  where a.slug = 'founding'
    and ae.free_entry = true
    and ae.status in ('pending_payment', 'pending_review', 'approved', 'competing', 'finished')
) ranked
where ranked.slot <= 10
on conflict do nothing;

update public.arena_entries ae
set free_entry = exists (
  select 1 from public.founding_free_entry_allocations allocation
  where allocation.entry_id = ae.id
)
from public.arenas a
where a.id = ae.arena_id and a.slug = 'founding';

update public.payments payment
set amount = 0,
    metadata = coalesce(payment.metadata, '{}'::jsonb) || jsonb_build_object(
      'promotion', 'founding-first-10-approved',
      'free_entry_slot', allocation.slot
    )
from public.founding_free_entry_allocations allocation
join public.arena_entries entry on entry.id = allocation.entry_id
where payment.id = entry.payment_id
  and payment.status in ('pending', 'paid');

create or replace function public.claim_founding_free_entry(p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arena_id uuid;
  v_slug text;
  v_status text;
  v_payment_id uuid;
  v_slot smallint;
begin
  select arena_id into v_arena_id
  from public.arena_entries
  where id = p_entry_id;

  if v_arena_id is null then
    raise exception 'entry_not_found';
  end if;

  -- The Arena row is the allocation mutex, so concurrent checkouts cannot
  -- claim the same final slot.
  select slug into v_slug
  from public.arenas
  where id = v_arena_id
  for update;

  select status, payment_id into v_status, v_payment_id
  from public.arena_entries
  where id = p_entry_id and arena_id = v_arena_id
  for update;

  if v_slug is distinct from 'founding' or v_status <> 'pending_payment' then
    return false;
  end if;

  if exists (
    select 1 from public.founding_free_entry_allocations where entry_id = p_entry_id
  ) then
    return true;
  end if;

  select candidate.slot into v_slot
  from generate_series(1, 10) as candidate(slot)
  where not exists (
    select 1 from public.founding_free_entry_allocations allocation
    where allocation.slot = candidate.slot
  )
  order by candidate.slot
  limit 1;

  if v_slot is null then
    return false;
  end if;

  insert into public.founding_free_entry_allocations (slot, arena_id, entry_id)
  values (v_slot, v_arena_id, p_entry_id);

  update public.arena_entries
  set free_entry = true
  where id = p_entry_id;

  update public.payments
  set amount = 0,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'promotion', 'founding-first-10-approved',
        'free_entry_slot', v_slot
      )
  where id = v_payment_id and status = 'pending';

  return true;
end;
$$;

create or replace function public.release_founding_free_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('rejected', 'withdrawn', 'disqualified') and old.free_entry = true then
    delete from public.founding_free_entry_allocations where entry_id = new.id;
    new.free_entry := false;
  end if;
  return new;
end;
$$;

drop trigger if exists arena_entries_sync_founding_free_entry on public.arena_entries;
drop trigger if exists arena_entries_release_founding_free_entry on public.arena_entries;
create trigger arena_entries_release_founding_free_entry
  before update of status on public.arena_entries
  for each row
  execute function public.release_founding_free_entry();

create or replace function public.approve_founding_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.arena_entries%rowtype;
  v_arena_id uuid;
  v_slug text;
  v_free_approved integer;
begin
  select arena_id into v_arena_id
  from public.arena_entries
  where id = p_entry_id;

  if v_arena_id is null then
    raise exception 'entry_not_found';
  end if;

  select slug into v_slug
  from public.arenas
  where id = v_arena_id
  for update;

  select * into v_entry
  from public.arena_entries
  where id = p_entry_id
  for update;

  if v_slug = 'founding' and v_entry.free_entry = false then
    select count(*) into v_free_approved
    from public.arena_entries
    where arena_id = v_arena_id
      and free_entry = true
      and status in ('approved', 'competing', 'finished');

    if v_free_approved < 10 then
      raise exception 'founding_free_approvals_pending';
    end if;
  end if;

  perform public.approve_entry(p_entry_id);
end;
$$;

revoke all on function public.claim_founding_free_entry(uuid) from public;
revoke all on function public.release_founding_free_entry() from public;
revoke all on function public.approve_founding_entry(uuid) from public;
grant execute on function public.claim_founding_free_entry(uuid) to service_role;
grant execute on function public.approve_founding_entry(uuid) to service_role;
