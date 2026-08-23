/**
 * One place for every $PRENA failure state the UI can reach. Nothing here
 * leaves the user on an indefinite spinner: each message says what happened and,
 * where a retry is safe, the caller shows one.
 */

export const PRENA_ERRORS: Record<string, string> = {
  // Wallet availability and connection
  wallet_unavailable: 'No wallet detected in this browser.',
  wallet_not_linked: 'Connect a wallet to continue.',
  wallet_not_verified: 'That wallet is not verified on your account.',
  wallet_taken: 'That wallet is already linked to another Builder account.',
  wallet_mismatch: 'This reward is addressed to a different wallet.',
  wrong_network: 'Your wallet is on the wrong network.',
  connect_rejected: 'Wallet connection was declined.',
  connect_failed: 'Could not reach your wallet. Try again.',
  switch_rejected: 'Network switch was declined.',
  switch_failed: 'Could not switch network. Change it in your wallet and retry.',

  // Signing and linking
  signature_rejected: 'Signature declined. Nothing was changed.',
  bad_signature: 'That signature did not match the wallet.',
  message_mismatch: 'The signed message did not match the challenge.',
  nonce_expired: 'The request expired. Start again.',
  nonce_used: 'That request was already used. Start again.',
  nonce_not_found: 'The request could not be found. Start again.',
  nonce_purpose_mismatch: 'The request does not match this action.',
  reward_pending: 'This wallet has an unclaimed reward. Claim it before unlinking.',
  payment_pending: 'This wallet has a payment in progress. Wait for it to settle.',

  // Quotes and pricing
  quote_expired: 'The quote expired. Refresh to get a new one.',
  quote_consumed: 'That quote was already used.',
  quote_mismatch: 'That quote does not match this Arena.',
  price_unavailable: 'Token pricing is unavailable right now. Card entry still works.',
  prena_not_configured: '$PRENA entry is not available yet.',
  prena_entry_disabled: 'This Arena does not accept $PRENA entry.',
  treasury_not_configured: '$PRENA entry is not available yet.',

  // Payment
  insufficient_balance: 'Insufficient $PRENA.',
  transaction_rejected: 'Transaction declined in your wallet. Nothing was charged.',
  transaction_failed: 'The transaction did not succeed.',
  tx_reverted: 'The transaction reverted on-chain.',
  tx_pending: 'Waiting for the transaction to confirm.',
  tx_not_found: 'The network has not seen that transaction yet.',
  tx_already_used: 'That transaction was already used for an entry.',
  duplicate_tx: 'That transaction was already used for an entry.',
  tx_already_attached: 'A different transaction is already recorded for this entry.',
  wrong_recipient: 'The transaction did not pay the Arena treasury.',
  wrong_sender: 'The transaction came from a different wallet.',
  wrong_token: 'The transaction moved a different token.',
  wrong_chain: 'The transaction was on a different network.',
  amount_too_low: 'The transaction paid less than the quoted amount.',
  rpc_unavailable: 'The network is unreachable. Your entry is safe — retry shortly.',
  payment_closed: 'This payment is already closed.',
  payment_not_found: 'That payment could not be found.',
  payment_failed: 'The payment could not be completed.',

  // Entry
  arena_full: 'That Arena is full.',
  arena_closed: 'That Arena is not open for entry.',
  registration_closed: 'Registration has closed for that Arena.',
  registration_not_open: 'Registration has not opened yet.',
  already_entered: 'That Project is already entered.',
  not_project_owner: 'You do not own that Project.',

  // Rewards
  already_claimed: 'This reward was already claimed.',
  not_claimable: 'This reward is not claimable yet.',
  allocation_not_found: 'That reward could not be found.',
  claim_failed: 'The claim could not be completed.',
  claim_unavailable: 'Claiming is not available yet for this reward.',

  // Generic
  auth_required: 'Sign in to continue.',
  forbidden: 'You are not allowed to do that.',
  rate_limited: 'Too many attempts. Wait a moment and try again.',
  not_configured: 'This feature is not configured yet.',
  network_error: 'Network error. Nothing was charged.',
};

export function prenaError(code: string | null | undefined, fallback = 'Something went wrong.'): string {
  if (!code) return fallback;
  return PRENA_ERRORS[code] ?? fallback;
}

/** Failure codes where showing a retry button is safe. */
const RETRYABLE = new Set([
  'connect_failed',
  'switch_failed',
  'rpc_unavailable',
  'tx_pending',
  'tx_not_found',
  'network_error',
  'price_unavailable',
  'rate_limited',
  'quote_expired',
  'signature_rejected',
  'connect_rejected',
  'switch_rejected',
  'transaction_rejected',
]);

export function isRetryable(code: string | null | undefined): boolean {
  return Boolean(code && RETRYABLE.has(code));
}
