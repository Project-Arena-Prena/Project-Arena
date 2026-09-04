# Changelog

All notable changes to Project Arena are recorded here.

## Unreleased

### Changed

- Replaced one-click Builder sign-in with a six-digit email verification flow
  that is resilient to link-prefetching security scanners.
- Hardened transactional email delivery with retry-safe outbox behavior,
  provider error recording, and per-message idempotency keys.
- Switched the Playwright wallet harness to the stable Webpack development
  server so CI reaches the browser tests within its job budget.
- Added launch-readiness documentation for authentication, payments, email,
  lifecycle finalization, analytics, and refund rehearsal evidence.
- Ignored the local npm cache directory used by release validation.

### Verified

- TypeScript validation passes.
- ESLint passes.
- The optimized Next.js production build passes and generates all application
  routes successfully.
- The deterministic Arena clock reaches every lifecycle phase and selects a
  Champion with the expected Arena Rating change.

### Remaining launch gates

- Deploy and prove Builder sign-in with two independent accounts.
- Prove sandbox Checkout, signed webhook fulfillment, idempotent replay, and
  refund reconciliation.
- Verify authenticated transactional email delivery from the production
  domain.
- Establish the production database migration baseline before applying the
  immutable-results migration.
- Complete the end-to-end launch rehearsal and attach evidence to the release
  pull request.
- Re-run the wallet smoke job and require a successful browser-test result.

