-- Indexes for the wallet_address query patterns Phase 3 introduced.
-- Idempotent. Safe to re-run.
--
-- Both tables are queried by wallet_address and neither was indexed for it:
--   * unlinkWallet counts open payments and open rewards for an address
--   * the mock chain provider reads both on every balance lookup, and mock is
--     the default mode, so a dashboard render was seq-scanning both tables.

create index if not exists token_payments_wallet_idx
  on public.token_payments (wallet_address);

create index if not exists reward_allocations_wallet_idx
  on public.reward_allocations (wallet_address)
  where wallet_address is not null;
