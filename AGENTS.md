# Project Arena agent contract

This file is the root instruction set for coding agents. `agents.md` contains the
product positioning and terminology contract; read it before changing product
copy, scoring, Arena lifecycle, payments, or Builder flows.

## Mission

Ship the smallest trustworthy loop in which a Builder discovers an Arena,
creates a Project, pays for an Arena Entry, competes, receives measurable
traffic, sees a permanent result, and has a reason to enter again.

Money buys participation and optional exposure products. It never buys Arena
Score, rank, Champion status, or Arena Rating.

## Current launch priority

The Founding Arena is the only P0. Do not expand `$PRENA`, add subscriptions,
build Battles, or add social features until the paid entry loop has completed
with a real external Builder. Use `docs/founding-arena-launch-readiness.md` as
the launch gate and `docs/roadmap.md` for sequencing.

## Authority boundaries

- Supabase/Postgres is authoritative for Builders, Projects, Arena Entries,
  scoring, lifecycle, payments, and frozen results.
- Stripe webhooks are authoritative for payment completion. A success redirect
  must never create or approve an Arena Entry.
- Rank, score, payment state, and lifecycle transitions are server-only.
- Finalized results are immutable except through an authenticated, audited
  correction workflow.
- Never expose `SUPABASE_SECRET_KEY`, service-role keys, Stripe restricted or
  secret keys, webhook secrets, `CRON_SECRET`, or `FRAUD_SALT` to client code,
  logs, fixtures, screenshots, or committed files.
- Treat production database changes, live Stripe writes, refunds, email sends,
  and production deploys as stateful operations. Verify the exact target and
  follow the relevant runbook before acting.

## Required workflow

1. Read the relevant code, migration, and runbook before editing.
2. Confirm whether an Arena is currently live before any production schema or
   lifecycle mutation. Do not migrate or reseed during a live Arena.
3. Work on a focused branch. Preserve unrelated changes and existing data.
4. For database work, create an additive migration; never edit an already
   applied migration. Run Supabase security and performance advisors after DDL.
5. For payment work, test in Stripe sandbox first. Verify webhook signatures,
   amount/currency, metadata linkage, and event idempotency.
6. Run `npm run typecheck`, `npm run lint`, and `npm run build`. Run the relevant
   Playwright or dry-run suite for changed flows.
7. Record evidence in the PR: tests, preview URL, migration order, rollback or
   recovery path, and any manual production step still required.

## Definition of done

A change is not done because the UI renders. It is done when its authoritative
state transition is verified, failure and retry behavior are understood,
security boundaries remain intact, tests pass, and the operator runbook is
accurate.

