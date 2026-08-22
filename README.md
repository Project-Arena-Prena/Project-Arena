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

Other scripts: `npm run build`, `npm run start`, `npm run lint`, `npm run typecheck`.

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

The schema ships `arena_status` and `project_category` enums, six tables, an `arena_standings` view
that computes rank with a window function, RLS on every table, and four `SECURITY DEFINER` functions
that match the API routes one to one:

| Function                                | Called by                  |
| --------------------------------------- | -------------------------- |
| `record_support(project_slug, arena_slug)` | `POST /api/support`     |
| `record_click(project_slug, arena_slug)`   | `POST /api/click`       |
| `create_paid_entry(...)`                   | `POST /api/stripe/webhook` |
| `finalize_arena(arena_slug)`               | Operator, when a clock stops |

Reads are public on Projects, Arenas, entries, and the standings view. Support and click rows are
insert-only for anonymous visitors and readable by the service role alone. `create_paid_entry` and
`finalize_arena` are service role only.

`supports` deduplicates per visitor per entry; clicks do not. `entries.score` is a stored generated
column, `supporters * 3 + clicks`.

## Stripe setup

1. Put your test secret key in `STRIPE_SECRET_KEY`.
2. Forward events locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

3. Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

Entries become real only in the webhook, never on the client success redirect, which a visitor can
reach without paying. The webhook verifies the signature, then calls `create_paid_entry`, which is
idempotent on the Checkout session id so redelivery is harmless. Zero-fee Arenas bypass Checkout.

## Deployment

Deploy to Vercel.

1. Import the repository. The framework preset is detected; no build overrides are needed.
2. Set all six variables from `.env.example` in Project Settings → Environment Variables.
   `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` are server only.
3. Set `NEXT_PUBLIC_SITE_URL` to the production origin, without a trailing slash.
4. Add a Stripe webhook endpoint at `https://<domain>/api/stripe/webhook` for
   `checkout.session.completed` and store its signing secret.
5. Add the production domain to Supabase → Authentication → URL Configuration.

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
| `/enter`           | Page      | Entry form, fee, Checkout handoff (`/enter/success` on return)  |
| `/dashboard`       | Page      | Builder view: own Projects, results, account                    |

| API                    | Method | Body / Result                                                              |
| ---------------------- | ------ | -------------------------------------------------------------------------- |
| `/api/support`         | POST   | `{ projectSlug, arenaSlug }` → records one Supporter                        |
| `/api/click`           | POST   | `{ projectSlug, arenaSlug? }` → records an outbound visit                    |
| `/api/checkout`        | POST   | `{ arenaSlug, projectName, tagline, url, category, description?, builderEmail }` → `{ url }` |
| `/api/stripe/webhook`  | POST   | Stripe signed event → creates the paid entry                                |

Dynamic routes are statically generated via `generateStaticParams`.
