-- Backfill immutable results for Arenas completed before the Founding Arena
-- lifecycle trigger existed. The original lifecycle backfill already marks
-- those Arenas as completed, so updating the phase again cannot fire the
-- result-capture trigger.

insert into public.arena_results (
  arena_id,
  project_id,
  final_rank,
  field_size,
  score,
  supporter_count,
  qualified_visit_count,
  impression_count,
  rating_before,
  rating_delta,
  rating_after,
  finalized_at
)
select
  ae.arena_id,
  ae.project_id,
  ae.final_rank,
  count(*) over (partition by ae.arena_id)::integer,
  ae.score,
  ae.supporter_count,
  ae.unique_visit_count,
  ae.impression_count,
  rh.rating_before,
  rh.rating_change,
  rh.rating_after,
  coalesce(a.ends_at, a.updated_at, now())
from public.arena_entries ae
join public.arenas a on a.id = ae.arena_id
left join public.arena_rating_history rh
  on rh.arena_id = ae.arena_id and rh.project_id = ae.project_id
where a.status = 'finished'
  and ae.status = 'finished'
  and ae.final_rank is not null
on conflict (arena_id, project_id) do nothing;

-- Public results are read-only. RLS already blocks mutations without a policy,
-- but explicit grants make the intended API surface unambiguous.
revoke all on public.arena_results from anon, authenticated;
grant select on public.arena_results to anon, authenticated;

-- Internal trigger functions are never part of the client RPC surface.
revoke all on function public.capture_arena_lifecycle_event() from public, anon, authenticated;
revoke all on function public.capture_arena_results() from public, anon, authenticated;
revoke all on function public.prevent_arena_result_mutation() from public, anon, authenticated;
revoke all on function public.guard_entry_approval_window() from public, anon, authenticated;
