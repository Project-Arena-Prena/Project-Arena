# Project Arena

Where projects compete for attention.

Internet projects enter timed Arenas. Supporters back them, spectators click through, and a live
timing board ranks the field in real time. When the clock stops, one Project is Champion, every
entrant's Arena Rating moves, and the result is permanent.

Discover. Compete. Get seen.

## Stack

| Layer      | Choice                                      |
| ---------- | ------------------------------------------- |
| Framework  | Next.js 15 (App Router, React 19 Server Components) |
| Language   | TypeScript, strict                          |
| Styling    | Tailwind CSS 3                              |
| Motion     | framer-motion                               |
| Icons      | lucide-react                                |
| Database   | Supabase (Postgres, RLS, RPC)               |
| Payments   | Stripe Checkout + webhooks                  |
| Validation | zod                                         |

Path alias: `@/*` → `./src/*`. All application code lives in `src/`.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

Other scripts: `npm run build`, `npm run start`, `npm run lint`, `npm run typecheck`, `npm run setup:env`, `npm run dry-run`.

First paid Arena: follow `docs/runbook-arena-001.md`. Admin → Dry-run runs the same clock.

## Runs without Supabase

The app boots with an empty `.env.local`. Every page reads through `src/lib/queries.ts`, the single
data surface, which is backed by the deterministic fixtures in `src/lib/mock-data.ts`. Nothing
fetches in a component, so swapping a query body for a Supabase call changes no UI.

The same fallback applies to writes. `src/lib/supabase/server.ts` returns `null` when the
environment is unset, so `/api/support` and `/api/click` accept the signal and reply
`{ ok: true, persisted: false }` instead of failing. `/api/checkout` skips Stripe when no secret key
is present and returns the success URL directly.

Fixture time is pinned to a fixed epoch so server and client render identically. Never call
`Date.now()` during a server render — time-dependent UI belongs in `src/components/countdown.tsx`.

## Database setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor (or `psql -f supabase/schema.sql`).
3. Run `supabase/seed.sql` for three Arenas, eight Projects, and their entries.
4. Copy the project URL, anon key, and service role key into `.env.local`.

Phase 2 schema covers Builders, project ownership, payments, Arena lifecycle
(`draft → registration → full → live → finished`), entry review, impressions, fraud flags,
Arena Rating history, and rank snapshots. Phase 3 adds the $PRENA utility layer:
`builder_wallets`, `wallet_nonces`, `prena_quotes`, `token_payments`, `arena_reward_pools`,
`arena_reward_tiers`, `reward_allocations`, and the derived `prena_activity` view.

Fresh projects run `supabase/schema.sql`. Existing Phase 1 databases run
`supabase/migrations/002_phase2_commercial.sql` then the function/RLS sections of
`schema.sql`. Existing Phase 2 databases run `supabase/migrations/004_phase3_prena.sql`,
which is idempotent.

Scoring is server-side only. `arena_entries.score` is a generated column
(`supporters + unique_visits * 2`). Payments never touch that formula.

Key RPCs (service role):

| Function | Called by |
| --- | --- |
| `start_checkout_entry` | `POST /api/checkout` |
| `confirm_paid_entry` | Stripe webhook |
| `approve_entry` / `reject_entry` | Admin entry review |
| `reconcile_arenas` | Cron + lazy reads |
| `start_arena` / `finalize_arena_by_id` | Lifecycle |
| `record_support` / `record_outbound_visit` / `record_impression` | Public events |
| `start_prena_entry` / `confirm_prena_entry` | $PRENA entry (server-verified) |
| `generate_arena_reward_allocations` | Reward engine, after an Arena freezes |
| `claim_reward` | Reward claim, guarded to run once |

## Stripe setup

1. Put your test secret key in `STRIPE_SECRET_KEY`.
2. Forward events locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

3. Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

Entries become real only in the webhook, never on the client success redirect. The handler verifies
the Stripe signature, records `stripe_events` for idempotency, and fulfills
`checkout.session.completed` plus `checkout.session.async_payment_succeeded` only when
`payment_status` is paid. Zero-fee Arenas skip Checkout and still land in pending review.

Prefer a [restricted API key](https://docs.stripe.com/keys/restricted-api-keys) with Checkout and
Refund permissions over a secret key. Store it as a sensitive Vercel environment variable.

Webhook events to enable: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `payment_intent.payment_failed`, `charge.refunded`.

## Deployment

Deploy to Vercel.

1. Import the repository. The framework preset is detected; no build overrides are needed.
2. Set all six variables from `.env.example` in Project Settings → Environment Variables.
   `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` are server only.
3. Set `NEXT_PUBLIC_SITE_URL` to the production origin, without a trailing slash.
4. Add a Stripe webhook endpoint at `https://<domain>/api/stripe/webhook` and store its signing secret.
5. Add the production domain to Supabase → Authentication → URL Configuration, including
   `https://<domain>/auth/callback`.
6. Set `ADMIN_EMAILS` to bootstrap the first operator. Optional: `CRON_SECRET`, `RESEND_API_KEY`.
7. Vercel Cron hits `/api/cron/reconcile` every minute. Reads also lazily reconcile Arena state.

`middleware.ts` refreshes the Supabase session on every request and is a no-op when the environment
is unset. Its matcher excludes static assets and the Stripe webhook, whose raw body must not be
touched.

## Routes

| Route              | Type      | Purpose                                                        |
| ------------------ | --------- | -------------------------------------------------------------- |
| `/`                | Page      | Live Arena, countdown, top of the board, standings preview      |
| `/arenas`          | Page      | Every Arena: live, upcoming, past                               |
| `/arena/[slug]`    | Page      | One Arena: timing strip, full leaderboard, entrants             |
| `/project/[slug]`  | Page      | One Project: career stats, Arena history, support and visit     |
| `/hall-of-fame`    | Page      | Champions by Arena, Arena Rating table                          |
| `/enter`           | Page      | Select Project, pay, pending review (`/enter/success` on return) |
| `/login`           | Page      | Builder magic link                                               |
| `/dashboard`       | Page      | Builder: Projects, live rank, upcoming, performance              |
| `/dashboard/prena` | Page      | Builder: $PRENA balance, rewards, entry and claim history        |
| `/admin`           | Page      | Operator: Arenas, entries, payments, fraud, analytics            |
| `/admin/prena`     | Page      | Operator: token payments, reward allocations, claim status       |

| API                    | Method | Body / Result                                                              |
| ---------------------- | ------ | -------------------------------------------------------------------------- |
| `/api/support`         | POST   | `{ projectSlug, arenaSlug, visitorId }` → records one valid supporter       |
| `/api/impressions`     | POST   | `{ projectSlug, arenaSlug, visitorId }` → viewport impression               |
| `/api/checkout`        | POST   | `{ arenaSlug, projectId }` → Stripe Checkout URL                            |
| `/api/stripe/webhook`  | POST   | Stripe signed event → confirms payment, creates pending-review entry        |
| `/api/cron/reconcile`  | GET    | Starts and finishes Arenas; expires token holds; drafts rewards             |
| `/api/wallet/nonce`    | POST   | `{ address, chainId, purpose }` → server-issued signing challenge           |
| `/api/wallet/link`     | POST   | `{ nonce, message, signature }` → verifies ownership, links the wallet      |
| `/api/wallet/balance`  | GET    | Server-side $PRENA balance for a verified wallet                            |
| `/api/prena/quote`     | POST   | `{ arenaSlug, projectId }` → authoritative, expiring token quote            |
| `/api/prena/entry`     | POST   | `{ quoteId, walletAddress, ... }` → holds a slot, returns a payment intent  |
| `/api/prena/entry/verify` | POST | `{ tokenPaymentId, txHash }` → re-reads the chain, then creates the entry   |
| `/api/rewards/challenge` | POST | `{ allocationId }` → claim signing challenge                                |
| `/api/rewards/claim`   | POST   | Signed claim → marks one allocation claimed, exactly once                   |

Dynamic routes are statically generated via `generateStaticParams`.

## $PRENA (Phase 3)

$PRENA is the participation and ecosystem utility layer. It buys a slot and a discount.
**It can never buy rank, votes, score, or victory.** There is no API that accepts token
spend and modifies an Arena score, and the reward engine only ever reads `final_rank`
after Arena scoring has frozen it.

Card entry is unchanged and always available. A wallet is never required to visit, to
compete, or to win.

### Modes

`PRENA_MODE=mock` (default) simulates balances, quotes, payments, confirmation, rewards,
and claiming through the identical service interfaces and database tables — the whole
flow is exercisable before the token is deployed. Simulated rows are labelled `mock` in
the database and in the UI.

`PRENA_MODE=onchain` requires a deployed token, a treasury, an RPC endpoint, and
`PRENA_PRICE_SOURCE_URL`. Quoting deliberately hard-fails rather than falling back to the
development price. `/admin/prena` lists whatever configuration is still missing.

See `.env.example` for every variable. No contract address, chain id, or treasury is
hard-coded anywhere in application code.

### Services

| Path | Responsibility |
| --- | --- |
| `src/services/chain/` | The only blockchain abstraction: mock and onchain providers |
| `src/services/wallet.ts` | Nonces, signature verification, linking, unlinking |
| `src/services/token.ts` | Balance reads |
| `src/services/tokenQuote.ts` | Authoritative, expiring USD → token quotes |
| `src/services/tokenPayment.ts` | Payment intents and server-side verification |
| `src/services/rewards.ts` | Pools, tiers, allocation, claiming |
| `src/services/benefits.ts` | Configuration-driven perk checks |

No RPC call is made from a React component.

### Guarantees

| Guarantee | Enforced by |
| --- | --- |
| A wallet address is never trusted from the client | Signature over a single-use, expiring nonce |
| One wallet belongs to one Builder | `builder_wallets_address_unique` |
| One transaction hash funds one entry | `token_payments_tx_unique` on `(chain_id, tx_hash)` |
| A paid entry needs server-side proof | `verifyPrenaPayment` re-reads token, amount, recipient, sender, chain, and receipt |
| Token amounts survive uint256 precision | Base units stored as text; `parseBaseUnits` throws on anything else |
| A reward is claimable once | Row lock plus a `claimable → claimed` status guard in `claim_reward` |
| Token spend cannot change rank | No write path from any token table to a scoring column |

Base-unit amounts are stored as `text`, not `numeric`: PostgREST returns Postgres `numeric`
as a JavaScript number, which silently mangles a value like `2407000000000000000000` into
`2.407e+21`. An amount check against that would accept an underpayment.

### Rehearsal

```bash
npm run dry-run:prena
```

Runs the full flow against a real database in mock mode — link, quote, entry, verified
payment, finish, rewards, claim — and asserts that forged signatures, replayed nonces,
reused transaction hashes, and double claims are all rejected, and that a Project's score
is unchanged by a token payment.

## Scout (foundation)

Scaffolding only. Nothing about Scout is live, and nothing in the app writes to
it. `supabase/migrations/006_scout_foundation.sql` settles the data model for a
future feature where supporters call how a Project will finish, so the shape is
decided before the feature is designed rather than after.

**There is no prediction, wagering, or staking mechanic in this release.** No UI,
no API route, and no service function creates a prediction. `scout_predictions`
exists and stays empty.

### Scout Points

Scout Points are a reputation balance. They are **non-transferable** and have
**no monetary value**: they are earned and spent only inside Project Arena, they
do not convert to $PRENA or to anything else, and they cannot be moved between
Builders. `src/services/scout.ts` exposes no transfer and no conversion because
the database has nowhere to put one.

If the prediction feature is ever built, it commits Scout Points and nothing
else — never $PRENA, and never a token-denominated stake. A prediction costs
points. It does not buy a share of a pot, because there is no pot.

### Guarantees

| Guarantee | Enforced by |
| --- | --- |
| Points have no monetary form | No token, wallet, chain, or price column exists; `assert_scout_non_monetary()` fails the migration if one is added |
| Points cannot move between Builders | `scout_points.builder_id` is immutable via `scout_points_owner_immutable` |
| A balance can never go negative | `balance >= 0`, plus an `insufficient_scout_points` guard under a row lock in `award_scout_points` |
| The ledger cannot be rewritten | `scout_point_events` rejects UPDATE and DELETE while the Builder exists |
| A prediction is locked once an Arena starts | `scout_predictions_locked` rejects `live` / `finished` / `cancelled` Arenas and any Arena past `starts_at` |
| One call per Builder per Project per Arena | `scout_predictions_unique` |
| Scout activity cannot change rank | No write path from any scout table or function to a scoring column |
