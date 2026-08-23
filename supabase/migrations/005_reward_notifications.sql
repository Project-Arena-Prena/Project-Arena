-- Project Arena — reward publication notifications.
-- Idempotent. Safe to re-run. Appended verbatim to supabase/schema.sql.
--
-- Rewards were allocated and approved silently: a Builder only learned about a
-- claimable allocation by opening the dashboard. Publishing is the one reward
-- transition a Builder can act on, so it is the one that queues mail.
--
-- HARD RULE UNCHANGED: this reads frozen rankings only. Nothing here writes
-- arena_entries.supporter_count / unique_visit_count / score / current_rank /
-- final_rank, or projects.arena_rating.

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
  v_ids uuid[];
  v_count integer;
  v_row record;
begin
  if p_to not in ('approved', 'claimable', 'cancelled') then raise exception 'bad_status'; end if;

  -- Collecting the ids rather than counting them keeps the notification scoped
  -- to the rows this call moved, not every allocation already claimable.
  with updated as (
    update public.reward_allocations
      set status = p_to,
          approved_at = case when p_to in ('approved', 'claimable') then coalesce(approved_at, now()) else approved_at end
      where arena_id = p_arena_id and status = p_from
      returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from updated;

  v_count := coalesce(array_length(v_ids, 1), 0);

  -- approved and cancelled are internal admin states; only claimable is news.
  -- The join drops allocations with no builder, and the guard drops builders
  -- with no address, so an unreachable winner never queues undeliverable mail.
  if p_from = 'approved' and p_to = 'claimable' then
    for v_row in
      select
        b.email as to_email,
        a.name as arena_name,
        a.slug as arena_slug,
        p.name as project_name,
        ra.amount,
        ra.token_symbol,
        coalesce(nullif(ra.label, ''), initcap(ra.reward_type)) as reward_label
      from public.reward_allocations ra
      join public.arenas a on a.id = ra.arena_id
      join public.projects p on p.id = ra.project_id
      join public.builders b on b.id = ra.builder_id
      where ra.id = any(v_ids)
        and coalesce(b.email, '') <> ''
    loop
      perform public.queue_email(
        'reward_claimable',
        v_row.to_email,
        jsonb_build_object(
          'arenaName', v_row.arena_name,
          'arenaSlug', v_row.arena_slug,
          'projectName', v_row.project_name,
          -- Text, not numeric: PostgREST would return numeric as a JavaScript
          -- number and round a large allocation in the rendered email.
          'amount', v_row.amount::text,
          'tokenSymbol', v_row.token_symbol,
          'rewardLabel', v_row.reward_label
        )
      );
    end loop;
  end if;

  return v_count;
end;
$$;
