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

### Remaining launch gates

- Send one fresh sandbox webhook event to prove the currently deployed signing
  secret matches the active endpoint.
- Verify all application lifecycle templates through real transactional email;
  the existing outbox rows are mocked rehearsal fixtures.
- Establish the production database migration baseline before applying the
  immutable-results migration.
- Complete the remaining finalization and lifecycle-email rehearsal evidence.

