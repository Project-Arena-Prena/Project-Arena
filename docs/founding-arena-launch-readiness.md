# Founding Arena launch readiness

Last verified: 2026-09-02 UTC.

## Verdict

**Status: not ready for real-money launch.** The product UI and core application
build are strong enough for a controlled rehearsal, but payment fulfillment,
transactional email, and the production database migration gate are not green.

Launch only when every P0 row below has evidence attached to the release PR.

## Current evidence

| Area | State | Evidence | Gate |
| --- | --- | --- | --- |
| Production site | Green | `https://www.projectarena.xyz` returns 200 from Vercel | P0 |
| Production deploy | Green | Main deployment `0d4f208` is `READY` | P0 |
| Build quality | Green | `typecheck`, `lint`, and production build pass locally | P0 |
| Cron protection | Green | Anonymous request to `/api/cron/reconcile` returns 401 | P0 |
| Domain email | Green | Hostinger mailbox `hello@projectarena.xyz` exists | P1 |
| Supabase health | Green | Project is `ACTIVE_HEALTHY` | P0 |
| Supabase advisors | Amber | 6 security warnings and 6 performance warnings; helper-function grants require explicit review | P0 |
| Founding migration | **Red** | `lifecycle_phase`, lifecycle events, and immutable result tables are absent in production | P0 |
| Migration history | **Red** | Supabase reports no recorded migrations despite a populated schema | P0 |
| Live Stripe account | **Red** | Zero webhook endpoints and zero Checkout Sessions | P0 |
| Stripe sandbox proof | **Red** | Sessions exist, but all observed sessions are expired/unpaid; no webhook endpoint exists | P0 |
| Payment ledger | **Red** | No paid payment row observed; existing rows are failed, refunded, or cancelled | P0 |
| Transactional email | **Red** | Outbox delivery is mocked; the deployed app has no configured provider | P0 |
| Auth | Amber | Historical PKCE/expired-link runtime errors exist; the recovery code is deployed but needs a fresh end-to-end proof | P0 |
| Lifecycle precision | Amber | Hobby cron runs daily; page reads lazily reconcile state | P1 |
| Current Arena | Caution | `open-arena-002` is live through 2026-09-04 10:43 UTC | Safety |

Database counts and seeded competition data are useful for rehearsal, but they
do not prove a paid production loop. Treat them as fixtures until provenance is
confirmed.

## P0 launch gates

### 1. Freeze production changes during the current live Arena

- Do not apply Founding Arena migrations, reseed, or edit lifecycle timestamps
  before `open-arena-002` finishes and its result is checked.
- Confirm the current board, Champion, rank history, and emails/outbox state
  before beginning the migration window.

### 2. Establish the database baseline

- Export a production schema-only backup and retain a restorable database
  backup before DDL.
- Compare production objects with `supabase/schema.sql` and every migration.
- Apply `20260827112225_founding_arena_ready.sql` first, then
  `20260827161940_backfill_founding_arena_results.sql`.
- Verify `arena_results`, `arena_lifecycle_events`, lifecycle RPC grants, and
  one frozen result set for each completed public Arena.
- Run Supabase security and performance advisors; resolve all security errors
  and document intentional RLS-with-no-policy tables and helper-function
  grants. The current advisor report includes `is_admin`, `owns_project`, and
  `ensure_builder`; do not revoke a grant required by an RLS policy without
  proving the policy still works.
- Record the baseline so future changes appear in migration history.

### 3. Prove Stripe sandbox end to end

- Create the sandbox webhook endpoint for
  `https://www.projectarena.xyz/api/stripe/webhook` or use a dedicated preview
  URL with matching preview environment variables.
- Subscribe to:
  `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`,
  `payment_intent.payment_failed`, and `charge.refunded`.
- Complete one card payment and prove this chain:
  Checkout Session paid -> signed webhook 2xx -> payment paid -> Entry pending
  review -> admin approval -> Entry competing.
- Replay the same event and prove there is no duplicate Entry or ledger change.
- Refund the payment and prove the local payment state reconciles.

### 4. Configure live Stripe safely

- Use the live `Project Arena` account and a least-privilege restricted key.
- Configure the live production webhook and store its distinct live signing
  secret as a sensitive Vercel environment variable.
- Set `NEXT_PUBLIC_SITE_URL=https://www.projectarena.xyz`.
- Run one low-value live Arena Entry with the operator's card, verify the full
  webhook path, then refund it. Do not accept public payments before this passes.

### 5. Turn on transactional email

- Choose a transactional sender. Hostinger Mail is the reply/inbox surface;
  the current application delivery adapter expects Resend.
- Verify a sender such as `arena@projectarena.xyz`, set `RESEND_API_KEY`,
  `EMAIL_FROM`, and `EMAIL_REPLY_TO=hello@projectarena.xyz` in Vercel, then
  redeploy.
- Send and receive each lifecycle template: payment received, approved,
  starting, finished, and reward claimable.
- Confirm SPF, DKIM, and DMARC alignment and that replies reach Hostinger.

### 6. Re-prove Builder authentication

- Request a new magic link on `www.projectarena.xyz` and open it in the same
  browser.
- Verify redirect to `/dashboard`, session persistence after refresh, admin
  redirect for the operator, and sign-out.
- Verify Supabase Site URL and redirect allowlist use the canonical `www`
  origin. Old or cross-browser links may fail by design; the UI must recover
  cleanly.

### 7. Run the launch rehearsal

Follow `docs/runbook-arena-001.md` with two independent Builder accounts. Save
evidence for checkout, webhook delivery, approval, scoring, fraud review,
finalization, immutable results, Hall of Fame, analytics, email, and refund.

## Go/no-go rule

Go only when the seven P0 gates are green. If payment, auth, finalization, or
email fails, postpone the public opening; do not manually promote rows to make
the UI appear ready.
