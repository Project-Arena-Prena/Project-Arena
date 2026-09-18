alter table public.arena_entries
  add column if not exists free_entry boolean not null default false;

create index if not exists arena_entries_founding_free_idx
  on public.arena_entries (arena_id, free_entry, status)
  where free_entry and status in ('approved', 'competing', 'finished');

create or replace function public.sync_founding_free_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_free_count integer;
begin
  if tg_op not in ('INSERT', 'UPDATE') then
    return new;
  end if;

  select slug into v_slug
  from public.arenas
  where id = new.arena_id;

  if v_slug is distinct from 'founding' then
    new.free_entry := false;
    return new;
  end if;

  if new.status not in ('approved', 'competing', 'finished') then
    new.free_entry := false;
    return new;
  end if;

  select count(*) into v_free_count
  from public.arena_entries ae
  join public.arenas a on a.id = ae.arena_id
  where a.slug = 'founding'
    and ae.status in ('approved', 'competing', 'finished')
    and ae.free_entry = true
    and ae.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_free_count < 10 then
    new.free_entry := true;
  else
    new.free_entry := false;
  end if;

  return new;
end;
$$;

drop trigger if exists arena_entries_sync_founding_free_entry on public.arena_entries;
create trigger arena_entries_sync_founding_free_entry
  before insert or update of status on public.arena_entries
  for each row
  execute function public.sync_founding_free_entry();

update public.arena_entries ae
set free_entry = true
from public.arenas a
where a.id = ae.arena_id
  and a.slug = 'founding'
  and ae.status in ('approved', 'competing', 'finished')
  and ae.free_entry = false
  and (
    select count(*)
    from public.arena_entries ae2
    join public.arenas a2 on a2.id = ae2.arena_id
    where a2.slug = 'founding'
      and ae2.status in ('approved', 'competing', 'finished')
      and ae2.free_entry = true
      and ae2.id <> ae.id
  ) < 10;

update public.arena_entries ae
set free_entry = false
from public.arenas a
where a.id = ae.arena_id
  and a.slug = 'founding'
  and ae.status in ('approved', 'competing', 'finished')
  and ae.free_entry = true
  and (
    select count(*)
    from public.arena_entries ae2
    join public.arenas a2 on a2.id = ae2.arena_id
    where a2.slug = 'founding'
      and ae2.status in ('approved', 'competing', 'finished')
      and ae2.free_entry = true
      and ae2.id <> ae.id
  ) >= 10;
