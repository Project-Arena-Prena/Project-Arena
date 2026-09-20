# Founding Arena — September 2026 launch

## Confirmed event

| Item | Decision |
| --- | --- |
| Public dates | 24–25 September 2026, Western Indonesia Time (UTC+7) |
| Exact live window | 23 September 17:00 UTC → 25 September 17:00 UTC |
| Registration close | 23 September 17:00 UTC |
| Field capacity | 24 Projects |
| Free allocation | First 10 approved Projects |
| Later Arena Entry | USD 29 |
| Category | Open |
| Scoring | 1 point per unique Supporter; 2 points per qualified outbound visit |

Money buys Arena Entry only. Score, rank, Champion status, and Arena Rating are
earned during the live competition.

## Free-entry contract

The checkout route claims one of ten database-backed slots under an Arena row
lock. This prevents concurrent requests from creating an eleventh free entry.
The reservation is released when an entry is rejected, withdrawn, or
disqualified. Paid entries cannot be approved until ten free Projects have
actually been approved, so the public promise remains true even when reviews
happen out of order.

## Deployment order

1. Back up production and confirm the existing migration baseline.
2. Apply `20260918120000_founding_free_entry_allocation.sql` if it has not run.
3. Apply `20260920080002_founding_free_reservation_fix.sql`.
4. Apply `20260920080015_schedule_founding_arena.sql`.
5. Run Supabase security and performance advisors.
6. Deploy the application preview and test one free submission, rejection,
   re-allocation, and approval.
7. In Stripe test mode, fill all ten free slots and complete the eleventh USD 29
   Checkout. Verify the signed webhook moves it to `pending_review`.
8. Run a live low-value payment/refund proof before accepting a paid public
   entry. Then promote the verified preview to production.

## Launch gate

- `/arena/founding` shows the correct dates and free-entry promise.
- Registration, login, Project creation, and the free success state work on
  mobile and desktop.
- Admin can approve and reject, and rejection releases the free slot.
- The eleventh active reservation goes through Stripe Checkout.
- Webhook signature verification and event idempotency are proven.
- The lifecycle clock starts and ends the Arena at the timestamps above.
- Transactional emails arrive and replies go to the monitored inbox.
