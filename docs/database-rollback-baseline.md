# Founding Arena database rollback baseline

The production migration has a private, database-resident rollback baseline in
`launch_backup_20260905`. It is a short-term recovery point for the Founding
Arena migration, not off-site disaster recovery.

## Captured state

Captured at `2026-09-05 17:39:08 UTC` before the lifecycle and immutable-result
migrations:

| Table | Rows | Hash |
| --- | ---: | --- |
| `analytics_events` | 263 | Matches source |
| `arena_entries` | 77 | Matches source |
| `arenas` | 20 | Matches source |
| `outbound_visits` | 317 | Matches source |

The manifest enforces equal source/backup row counts and content hashes. Access
checks confirmed that `anon`, `authenticated`, and `service_role` cannot use
the backup schema. Only direct database administration can read it.

## Restore policy

Do not restore casually. The baseline predates the new columns and immutable
result tables, so restoring it is a controlled migration rollback:

1. Stop writes and record the incident time.
2. Verify `launch_backup_20260905.manifest` and capture a fresh incident dump.
3. Revert the Founding Arena DDL in one transaction.
4. Restore only the original columns from the four snapshot tables.
5. Re-run row-count and content-hash checks before reopening writes.

The migration adds data rather than destructively rewriting original columns.
The only repair to an original column was filling a missing Champion for
`launch-arena-000`; existing Champion selections were never overwritten.

Keep this schema until the release has completed its observation window. Its
eventual removal is a separate destructive operation that requires an explicit
operator decision.

## Disaster-recovery boundary

Supabase Free does not provide scheduled project backups. Before accepting real
money, upgrade to a plan with managed backups or establish an encrypted off-site
`pg_dump` routine and prove a restore into an isolated project.

