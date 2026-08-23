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
Arena Rating history, and rank snapshots. Fresh projects run `supabase/schema.sql`. Existing
Phase 1 databases run `supabase/migrations/002_phase2_commercial.sql` then the function/RLS
sections of `schema.sql`.

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
| `/admin`           | Page      | Operator: Arenas, entries, payments, fraud, analytics            |

| API                    | Method | Body / Result                                                              |
| ---------------------- | ------ | -------------------------------------------------------------------------- |
| `/api/support`         | POST   | `{ projectSlug, arenaSlug, visitorId }` → records one valid supporter       |
| `/api/impressions`     | POST   | `{ projectSlug, arenaSlug, visitorId }` → viewport impression               |
| `/api/checkout`        | POST   | `{ arenaSlug, projectId }` → Stripe Checkout URL                            |
| `/api/stripe/webhook`  | POST   | Stripe signed event → confirms payment, creates pending-review entry        |
| `/api/cron/reconcile`  | GET    | Starts and finishes Arenas from server time                                 |

Dynamic routes are statically generated via `generateStaticParams`.
