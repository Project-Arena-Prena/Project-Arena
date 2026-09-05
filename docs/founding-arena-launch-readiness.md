# Founding Arena launch readiness

Last verified: 2026-09-05 UTC.

## Verdict

**Status: not ready for real-money launch.** Authentication, inbound email,
the application build, and CI are green. The remaining blockers are a
recoverable production database baseline, the immutable-results migration,
current Stripe signing-secret proof, and real lifecycle-email delivery.

Launch only when every P0 row below has evidence attached to the release PR.

## Current evidence

| Area | State | Evidence | Gate |
| --- | --- | --- | --- |
| Production site | Green | `https://www.projectarena.xyz` returns 200 from Vercel | P0 |
| Production deploy | Green | Main deployment `0d4f208` is `READY` | P0 |
| Build quality | Green | `typecheck`, `lint`, and production build pass locally | P0 |
| Cron protection | Green | Anonymous request to `/api/cron/reconcile` returns 401 | P0 |
| Domain email | Green | Vercel DNS now publishes Hostinger's two apex MX records; delayed mail recovered and a fresh Project Arena code arrived at `hello@projectarena.xyz` | P1 |
| Supabase health | Green | Project is `ACTIVE_HEALTHY` | P0 |
| Supabase advisors | Amber | 6 security warnings and 6 performance warnings; helper-function grants require explicit review | P0 |
| Founding migration | **Red** | `lifecycle_phase`, lifecycle events, and immutable result tables are absent in production | P0 |
| Migration history | **Red** | Supabase reports no recorded migrations despite a populated schema | P0 |
| Live Stripe account | Green | Production endpoint is enabled at the canonical webhook URL with the five required Checkout/payment/refund events | P0 |
| Stripe sandbox proof | Amber | The sandbox endpoint is enabled for all five required events. Two $29 test PaymentIntents reached Project Arena's ledger and were fully refunded. `STRIPE_WEBHOOK_SECRET` and `STRIPE_SECRET_KEY` exist for Production and Preview, but a fresh event has not yet proven that the current endpoint and deployed secret are paired | P0 |
| Payment ledger | Green | Two sandbox payments were fulfilled into paid ledger rows and approved Arena Entries, then both reconciled to `refunded` without duplicate entries | P0 |
| Transactional email | Amber | Resend DNS and Supabase custom SMTP are active and auth-code delivery is proven; all 48 application lifecycle messages are still `mocked`, so real lifecycle delivery remains unproven | P0 |
| Auth | Green | Canonical URLs, Resend SMTP, code-only templates, six-digit token length, redirect, refresh persistence, admin access, and sign-out are proven; a second independent account successfully signed in through the Hostinger mailbox | P0 |
| CI wallet smoke | Green | PR #16 merged after both `quality` and `wallet-smoke` completed successfully in workflow run `33913622140` | P0 |
| Lifecycle precision | Amber | Hobby cron runs daily; page reads lazily reconcile state | P1 |
| Latest Arena result | **Red** | `open-arena-002` finished with three projects at rank 1 and thirteen at rank 4. Nightmarket is the preserved Champion, while all three rank-1 projects received `+100`; the pending migration now preserves these historical ties and applies a total order only to future Arenas | P0 |

Database counts and seeded competition data are useful for rehearsal, but they
do not prove a paid production loop. Treat them as fixtures until provenance is
confirmed.

## P0 launch gates

### 1. Preserve and audit the completed Arena

- Do not reseed or edit the completed `open-arena-002` result.
- Preserve evidence that Nightmarket, Glyphset, and Atlasnote received rank 1
  and `+100` Arena Rating while Nightmarket alone was marked Champion.
- Preserve the thirteen rank-4 results as published. Historical competition
  ranks may repeat; immutable results are unique by Arena and Project, not by
  Arena and final rank.
- Apply the total-order finalizer only after the backup and migration-baseline
  gate below; then prove future ties produce unique, deterministic ranks.

### 2. Establish the database baseline

- Export a production schema-only backup and retain a restorable database
  backup before DDL. The project is on Supabase Free, which explicitly has no
  scheduled backups; use `supabase db dump`/`pg_dump` or upgrade before applying
  these migrations.
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

- Revalidate the existing sandbox webhook endpoint at
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
- Historical sandbox rows prove the fulfillment, approval, idempotency-shaped
  ledger, and refund model. Send one fresh signed event before launch to prove
  the currently deployed webhook secret.

### 4. Configure live Stripe safely

- Use the live `Project Arena` account and a least-privilege restricted key.
- Configure the live production webhook and store its distinct live signing
  secret as a sensitive Vercel environment variable.
- Set `NEXT_PUBLIC_SITE_URL=https://www.projectarena.xyz`.
- Run one low-value live Arena Entry with the operator's card, verify the full
  webhook path, then refund it. Do not accept public payments before this passes.

### 5. Turn on transactional email

- Keep Resend as the transactional sender and Hostinger Mail as the reply/inbox
  surface. `RESEND_API_KEY` is installed in Production and auth mail is arriving;
  verify `EMAIL_FROM` and `EMAIL_REPLY_TO=hello@projectarena.xyz`, then redeploy
  if either value changes.
- Send and receive each lifecycle template: payment received, approved,
  starting, finished, and reward claimable.
- Confirm SPF, DKIM, and DMARC alignment and that replies reach Hostinger.

### 6. Keep Builder authentication green

- Repeat the two-account sign-in check as a release smoke test; it passed on
  2026-09-05 for Gmail and `hello@projectarena.xyz`.
- Preserve redirect to `/dashboard`, session persistence after refresh, admin
  redirect for the operator, and sign-out behavior.
- Verify Supabase Site URL and redirect allowlist use the canonical `www`
  origin. Do not put `{{ .ConfirmationURL }}` back into the email template;
  security scanners can consume one-click credentials before the Builder.

### 7. Run the launch rehearsal

Follow `docs/runbook-arena-001.md` with two independent Builder accounts. Save
evidence for checkout, webhook delivery, approval, scoring, fraud review,
finalization, immutable results, Hall of Fame, analytics, email, and refund.

### 8. Keep CI completion trustworthy

- Keep the wallet harness inaccessible in Production and available to local/CI
  development servers.
- Require both `quality` and `wallet-smoke`; PR #16 established the green
  baseline in workflow run `33913622140`.

## Go/no-go rule

Go only when the seven P0 gates are green. If payment, auth, finalization, or
email fails, postpone the public opening; do not manually promote rows to make
the UI appear ready.

