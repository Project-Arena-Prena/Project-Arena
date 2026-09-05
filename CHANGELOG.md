# Changelog

All notable changes to Project Arena are recorded here.

## Unreleased

### Changed

- Replaced one-click Builder sign-in with a six-digit email verification flow
  that is resilient to link-prefetching security scanners.
- Hardened transactional email delivery with retry-safe outbox behavior,
  provider error recording, and per-message idempotency keys.
- Kept the Playwright wallet harness production-inaccessible while allowing
  local and CI development servers to exercise it, and switched that harness
  to the stable Webpack development server.
- Added launch-readiness documentation for authentication, payments, email,
  lifecycle finalization, analytics, and refund rehearsal evidence.
- Ignored the local npm cache directory used by release validation.
- Published Hostinger's required apex MX records and corrected both Supabase
  auth templates to send six-digit codes through Resend.
- Adjusted the immutable-results migration to preserve historical competition
  ties while retaining deterministic total ordering for future Arenas.
- Added a private, hash-verified rollback baseline for the four production
  tables changed by the Founding Arena migration.
- Fixed the immutable-result guard to fail closed when no authorized correction
  context is present.
- Backfilled only missing historical Champions from immutable results without
  overwriting any existing Champion selection.
- Rotated the Stripe sandbox webhook signing secret in Vercel Production and
  Preview, redeployed the canonical site, and disabled every superseded
  Project Arena sandbox endpoint.
- Added an explicit Vercel upload denylist so local environment files, release
  scratch data, repository metadata, and test artifacts cannot enter deploy
  bundles.

### Verified

- TypeScript validation passes.
- ESLint passes.
- The optimized Next.js production build passes and generates all application
  routes successfully.
- The deterministic Arena clock reaches every lifecycle phase and selects a
  Champion with the expected Arena Rating change.
- Builder sign-in succeeds for two independent accounts, including delivery to
  the Hostinger mailbox.
- CI `quality` and `wallet-smoke` both pass on the merged wallet-harness fix.
- Two sandbox payments reached paid ledger rows and approved Arena Entries, and
  both refunds reconciled successfully.
- Production delivered all five application lifecycle templates through Resend
  to the Hostinger inbox with no provider errors.
- Production now has 62 immutable results for 62 finished entries, no duplicate
  Arena/Project records, no lifecycle gaps, no Champion mismatches, and the
  published `open-arena-002` ties remain intact.
- A direct update against an immutable result is blocked as expected.
- The active sandbox webhook secret matches the clean Production deployment:
  event `evt_pa_clean_deploy_1788634401` returned 200 and persisted exactly once; an
  identical replay returned 200 as a duplicate without creating a second row.
- Production deployment `dpl_9iwjKAVtgsZktciVB4iNY4dUKa6Y` completed as
  `READY`, was aliased to `www.projectarena.xyz`, and the canonical site
  returned 200.

### Remaining launch gates

- Establish managed or encrypted off-site database recovery before accepting
  real-money entries.
- Repeat one provider-originated sandbox webhook as a release smoke test when
  Stripe Workbench is available; its dashboard was unavailable during the
  signed production replay rehearsal.

