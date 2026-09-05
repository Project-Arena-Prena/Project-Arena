-- Repair historical finished Arenas that have immutable results but no Champion.
-- Existing Champion selections are authoritative and are never overwritten.

with deterministic_champions as (
  select distinct on (arena_id)
    arena_id,
    project_id
  from public.arena_results
  order by arena_id, final_rank asc, project_id asc
)
update public.arenas a
set champion_project_id = c.project_id
from deterministic_champions c
where a.id = c.arena_id
  and a.status = 'finished'
  and a.champion_project_id is null;

