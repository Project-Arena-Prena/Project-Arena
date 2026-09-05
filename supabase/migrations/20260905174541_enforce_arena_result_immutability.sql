-- Fail closed when no authorized correction context has been set.
-- `current_setting(..., true)` returns NULL for an unset key, so a normal
-- inequality comparison would not enter the guard branch.

create or replace function public.prevent_arena_result_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.arena_result_correction', true) is distinct from 'true' then
    raise exception 'arena results are immutable; use an authorized correction';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.prevent_arena_result_mutation()
from public, anon, authenticated;

