# Founding Arena launch readiness

Last verified: 2026-09-05 18:53 UTC.

## Verdict

**Status: not ready for real-money launch.** Authentication, inbound email,
the application build, CI, the migration rollback baseline, the Founding Arena
data model, and the current Stripe sandbox signing-secret pairing are green.
Managed off-site database recovery is still required before public real-money
launch.

Launch only when every P0 row below has evidence attached to the release PR.

## Current evidence

| Area | State | Evidence | Gate |
| --- | --- | --- | --- |
| Production site | Green | `https://www.projectarena.xyz` returns 200 from Vercel | P0 |
| Production deploy | Green | Clean deployment `dpl_9iwjKAVtgsZktciVB4iNY4dUKa6Y` is `READY` and aliased to the canonical domain | P0 |
| Build quality | Green | `typecheck`, `lint`, and production build pass locally | P0 |
| Deployment secret hygiene | Green | `.vercelignore` excludes local environment files and release scratch data from deployment uploads | P0 |
| Cron protection | Green | Anonymous request to `/api/cron/reconcile` returns 401 | P0 |
| Domain email | Green | Vercel DNS now publishes Hostinger's two apex MX records; delayed mail recovered and a fresh Project Arena code arrived at `hello@projectarena.xyz` | P1 |
| Supabase health | Green | Project is `ACTIVE_HEALTHY` | P0 |
| Supabase advisors | Amber | No security errors. The current report has 7 warnings and 13 informational findings; helper-function grants and leaked-password protection require explicit review | P1 |
| Founding migration | Green | Lifecycle state, audit events, immutable results, deterministic future ranking, and correction controls are live; the fail-closed immutability trigger passed a real blocked-update test | P0 |
| Migration history | Amber | The five launch migrations are recorded with production timestamps; older schema remains a documented manual baseline | P1 |
| Live Stripe account | Green | Production endpoint is enabled at the canonical webhook URL with the five required Checkout/payment/refund events | P0 |
| Stripe sandbox proof | Green | Rotated sandbox endpoint `we_1UCOYV501e4UkSme8fCfXMF9` is the only enabled Project Arena endpoint. A signed `payment_intent.payment_failed` rehearsal returned 200, persisted event `evt_pa_clean_deploy_1788634401` exactly once, and the identical replay returned 200 as a duplicate | P0 |
| Payment ledger | Green | Two sandbox payments were fulfilled into paid ledger rows and approved Arena Entries, then both reconciled to `refunded` without duplicate entries | P0 |
| Transactional email | Green | Production and Preview define the Resend sender and Hostinger reply address. Fresh payment-received, approved, starting, finished, and reward-claimable probes were marked `sent` without errors and all five arrived at `hello@projectarena.xyz` | P0 |
| Auth | Green | Canonical URLs, Resend SMTP, code-only templates, six-digit token length, redirect, refresh persistence, admin access, and sign-out are proven; a second independent account successfully signed in through the Hostinger mailbox | P0 |
| CI wallet smoke | Green | PR #16 merged after both `quality` and `wallet-smoke` completed successfully in workflow run `33913622140` | P0 |
| Lifecycle precision | Amber | Hobby cron runs daily; page reads lazily reconcile state | P1 |
| Latest Arena result | Green | All 62 finished entries were frozen into 62 immutable results with no duplicates. `open-arena-002` still has three projects at rank 1 and thirteen at rank 4, and its existing Champion was preserved. One older Arena with a missing Champion was repaired deterministically | P0 |

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

- The migration rollback baseline is retained in
  `launch_backup_20260905`; its four table counts and hashes match and all
  web-facing roles are denied. See `docs/database-rollback-baseline.md`.
- The project remains on Supabase Free, which has no scheduled backups. Upgrade
  or add an encrypted off-site dump-and-restore routine before accepting real
  money.
- Compare production objects with `supabase/schema.sql` and every migration.
- Production applied `20260905174049_founding_arena_ready.sql` first, then
  `20260905174123_backfill_founding_arena_results.sql`, followed by the
  Champion repair and fail-closed immutability fix.
- Verify `arena_results`, `arena_lifecycle_events`, lifecycle RPC grants, and
  one frozen result set for each completed public Arena.
- Run Supabase security and performance advisors; resolve all security errors
  and document intentional RLS-with-no-policy tables and helper-function
  grants. The current advisor report includes `is_admin`, `owns_project`, and
  `ensure_builder`; do not revoke a grant required by an RLS policy without
  proving the policy still works.
- The five launch changes now appear in migration history. Reconcile the older
  manually-created schema before relying on automated migration drift checks.

### 3. Prove Stripe sandbox end to end

- Keep the verified sandbox webhook endpoint at
  `https://www.projectarena.xyz/api/stripe/webhook`; Production and Preview use
  the same rotated sandbox signing secret, while superseded endpoints are
  disabled.
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
- Historical sandbox rows prove fulfillment, approval, and refund behavior.
  The current deployment proved signature verification and duplicate handling
  with `evt_pa_clean_deploy_1788634401`: the first delivery persisted once and the
  exact replay was acknowledged as a duplicate. Stripe Workbench was
  unavailable during this check, so repeat one provider-originated delivery as
  a release smoke test when the dashboard recovers.

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
  starting, finished, and reward claimable. This passed on 2026-09-05; repeat it
  as a release smoke test rather than relying on the older mocked fixtures.
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

