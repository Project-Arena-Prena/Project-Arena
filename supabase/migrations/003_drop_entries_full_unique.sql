-- One active entry per project per Arena. A refunded/rejected row must not
-- block the same Project from paying again. Matches start_checkout_entry.

alter table public.arena_entries
  drop constraint if exists arena_entries_arena_id_project_id_key;

create unique index if not exists arena_entries_active_unique
  on public.arena_entries (arena_id, project_id)
  where status in ('pending_payment', 'pending_review', 'approved', 'competing');
