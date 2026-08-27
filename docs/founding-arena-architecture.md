# Founding Arena architecture

## Existing foundation

Project Arena is a Next.js App Router application backed by Supabase. Server
routes and server components use the Supabase secret client for privileged
operations; browser clients never calculate rank, payment state, Arena Rating,
or lifecycle transitions.

| Concern | Existing authority |
| --- | --- |
| Paid Arena Entry | Stripe Checkout + signed `/api/stripe/webhook` |
| Entry approval | protected admin routes + service-only RPCs |
| Arena Score | generated from accepted supports and qualified outbound visits |
| Lifecycle | `reconcile_founding_arenas()` / legacy row-locking reconciliation |
| Rankings | `arena_entries`, `rank_snapshots`, and `arena_standings` |
| Long-term rating | immutable-per-Arena `arena_rating_history` |
| Admin access | Supabase-backed admin check and server routes |

## Founding Arena additions

The `20260827112225_founding_arena_ready.sql` migration is additive. It keeps
the current UI `status` values for compatibility while adding an authoritative
`lifecycle_phase`:

`draft → open → entry_closed → live → finalizing → completed`

It records transitions in `arena_lifecycle_events`, freezes one row per
Project in `arena_results`, and stores explicit authorized corrections in
`arena_result_corrections`. Public completed-Arena and Hall of Fame reads
prefer that frozen ledger.

**Qualified Visit v1** is an accepted, unique outbound visit for a competing
Project during a live Arena. It is marked by `outbound_visits.is_valid`, has a
`qualification_version`, and excludes duplicate/burst activity rejected by the
existing integrity RPC. Future qualification rules must write a new version;
they must never rewrite finalized results.

## Rollout order

1. Establish the production schema baseline. The current Supabase project has
   no recorded migration history, so do not blindly replay the full schema.
2. Apply `20260827112225_founding_arena_ready.sql` through the approved
   migration workflow, then run Supabase security and performance advisors.
3. Deploy this application commit. It safely falls back to legacy reconciliation
   and active standings until the migration is present.
4. Run a test-mode Arena through entry, Stripe webhook, approval, live scoring,
   finalization, `/arena/[slug]/results`, and Hall of Fame.
5. Before live charging, enable Supabase leaked-password protection and use a
   scheduler that can meet the desired lifecycle cadence. Vercel Hobby Cron is
   daily; it is only a backstop, not a precise event scheduler.

## Non-negotiable boundaries

- Money buys Arena Entry, never Arena Score or rank.
- Only server-side RPCs mutate lifecycle, counts, payment status, and ratings.
- Finalized results are immutable except through the audited correction RPC.
- Stripe webhooks remain raw-body signature verified and event-idempotent.
- Service-role and Stripe secret values never enter client code.
