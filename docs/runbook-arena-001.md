# Arena #001 operator runbook

Project Arena is ready to run a paid Arena when this checklist is green. Do not invent product features until one Builder has paid, seen traffic, and has a reason to enter again.

## 0. What this Arena is

- **Name:** Open Arena #001 (or the next unused number)
- **Format:** Open category, timed leaderboard
- **Score:** 1 support = 1 pt, 1 unique outbound visit = 2 pts
- **Entry:** paid slot via Stripe Checkout. Money does **not** buy rank.
- **Field cap:** 16 for the first paid run (32 only if demand is real)
- **Window:** 48 hours live. Registration open at least 7 days before start.

## 1. Environment

```bash
npm run setup:env
```

That writes gitignored `.env.local` from the logged-in Stripe sandbox and generates `CRON_SECRET` / `FRAUD_SALT`.

Still required (paste into `.env.local`):

| Variable | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same, publishable / anon key |
| `SUPABASE_SECRET_KEY` | secret or service-role key. Server only. |
| `ADMIN_EMAILS` | your Builder login email |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` locally, or Dashboard webhook in production |
| `NEXT_PUBLIC_SITE_URL` | production origin, no trailing slash |

Local webhooks:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_...` value into `STRIPE_WEBHOOK_SECRET`.

Production webhook URL: `https://<domain>/api/stripe/webhook`

Events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.payment_failed`
- `charge.refunded`

Supabase Auth → URL configuration must include `https://<domain>/auth/callback` and the site URL.

Vercel Cron already hits `/api/cron/reconcile` every minute (`vercel.json`). Set the same `CRON_SECRET` on Vercel.

## 2. Database

Fresh project:

```bash
# SQL editor or psql
psql -f supabase/schema.sql
psql -f supabase/seed.sql   # optional fixtures; skip for a clean first paid Arena
```

Existing Phase 1 database: `supabase/migrations/002_phase2_commercial.sql`, then `supabase/schema.sql`.

## 3. Prove the clock (before anyone pays)

```bash
npm run dry-run
```

That asserts draft → registration → live → finished, a frozen ranking, Champion +100 rating.

With Supabase configured:

```bash
npm run dry-run:arena
```

Or in the UI after signing in as admin: **Admin → Dry-run → Run database clock**.

On an existing Arena, **Go live now** / **Finish now** compress the timestamps and run the same RPCs the cron uses. Do not use those buttons on the public paid Arena except as an emergency.

Expected dry-run result:

- Champion is Kinetix
- Score = supporters + 2 × unique visits
- Champion Arena Rating +100
- Ranks do not move if you freeze twice

## 4. Create Open Arena #001

Admin → Arenas → Create Arena

| Field | First paid run |
| --- | --- |
| Name | Open Arena #001 |
| Slug | `open-arena-001` |
| Number | 1 |
| Category | Open |
| Capacity | 16 |
| Entry price (USD) | 29 |
| Registration opens | now |
| Registration closes | start time |
| Starts / Ends | 48-hour window, weekday if possible |
| Eligibility | Any internet project with a public URL |
| Status | `registration` (or draft, then Open registration) |

Save. Open `/arenas` as a spectator and confirm the card shows **N / 16 spots filled** and **$29**.

## 5. Entry path (test mode first)

Stripe is currently a **test sandbox** (`acct_1U7Meq501e4UkSme`, test key only). Keep it in test mode until the dry-run payment works.

1. Sign in as a Builder (`/login`).
2. Create a Project.
3. `/enter` → select Project → Continue to payment.
4. Pay with Stripe test card `4242 4242 4242 4242`.
5. Confirm webhook created **pending review** (not from the success URL alone).
6. Admin → Entries → Approve.
7. Project appears on the grid. Rank is still 0–0 until live.

Then repeat with a second Builder/Project so the board is not a single row.

## 6. Live operations

- Cron (or any public page load) flips `registration` → `live` at `starts_at`.
- Approved entries become `competing`. Pending review does **not** compete.
- When cap is hit, status becomes `full` and checkout is disabled.
- Do not edit scores. Inspect `/admin/fraud` if a project spikes.
- Refunds are manual: Admin → Payments → Refund. Rejection does not auto-refund.

If the Arena must stop early: **Finish now** (emergency) or wait for `ends_at`.

## 7. Close

At `ends_at` the clock:

1. Freezes scoring
2. Writes `final_rank`
3. Marks entries `finished`
4. Assigns Champion
5. Writes `arena_rating_history`
6. Queues result emails

Check:

- `/arena/open-arena-001` — board no longer moving
- `/hall-of-fame` — Champion recorded
- Builder performance page — visits, supporters, impressions, visit rate, rating change
- Share card + “Enter next Arena”

## 8. After the first paid Arena

Write down, from the admin dashboard:

- Fill rate (entries / 16)
- Checkout conversion
- Revenue
- Average outbound visits per Project
- Share rate
- Whether any Builder entered the next Arena

Schedule Open Arena #002 **before** #001 ends. That is the repeat-entry product.

## 9. Going live with real money

1. Claim or create a live Stripe account. Replace the sandbox test key with a **restricted** live key (`rk_live_`) that can create Checkout Sessions and refunds. Store it as a sensitive Vercel env var.
2. Create the production webhook and put `STRIPE_WEBHOOK_SECRET` on Vercel.
3. Switch `NEXT_PUBLIC_SITE_URL` to the production origin.
4. Keep `ADMIN_EMAILS` limited.
5. Run one $0 or $1 Arena on live keys with your own card, then refund it, before charging $29.

Do not enable `$PRENA`, subscriptions, or Battles until this loop has happened with a stranger’s card.
