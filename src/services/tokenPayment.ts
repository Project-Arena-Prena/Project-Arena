import { createAdminClient } from '@/lib/supabase/server';
import { normalizeAddress, prenaServerConfig, isTxHashLike } from '@/lib/prena/config';
import { formatTokenAmount, parseBaseUnits } from '@/lib/prena/amount';
import { trackEvent } from '@/lib/analytics';
import { chainProvider, mockTxHash, ChainError } from './chain';
import { walletBelongsToBuilder } from './wallet';

/**
 * $PRENA entry payments.
 *
 * A paid Arena Entry is never created because the frontend said the transaction
 * succeeded. createPrenaPaymentIntent reserves the slot; verifyPrenaPayment
 * independently re-reads the chain and checks token, amount, recipient, chain
 * id, receipt status, and hash uniqueness before confirm_prena_entry runs.
 */

export type TokenPaymentStatus = 'pending' | 'confirming' | 'confirmed' | 'failed' | 'expired' | 'refunded';

export interface PaymentIntent {
  tokenPaymentId: string;
  entryId: string;
  tokenAmount: string;
  tokenAmountFormatted: string;
  tokenDecimals: number;
  tokenContract: string | null;
  tokenSymbol: string;
  chainId: number;
  recipientAddress: string;
  arenaSlug: string;
  arenaName: string;
  mode: 'mock' | 'onchain';
}

export type IntentResult = { ok: true; intent: PaymentIntent } | { ok: false; error: string };

export async function createPrenaPaymentIntent(input: {
  builderId: string;
  arenaId: string;
  projectId: string;
  quoteId: string;
  walletAddress: string;
}): Promise<IntentResult> {
  const wallet = normalizeAddress(input.walletAddress);
  if (!wallet) return { ok: false, error: 'invalid_address' };

  const treasury = paymentRecipient();
  if (!treasury) return { ok: false, error: 'treasury_not_configured' };

  if (!(await walletBelongsToBuilder(input.builderId, wallet))) {
    return { ok: false, error: 'wallet_not_verified' };
  }

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const { data, error } = await supabase.rpc('start_prena_entry', {
    p_arena_id: input.arenaId,
    p_project_id: input.projectId,
    p_builder_id: input.builderId,
    p_quote_id: input.quoteId,
    p_wallet_address: wallet,
    p_recipient_address: treasury,
    p_mode: prenaServerConfig.mode,
  });

  if (error) return { ok: false, error: rpcError(error.message) };

  const payload = data as {
    entry_id: string;
    token_payment_id: string;
    token_amount: string;
    token_decimals: number;
    token_contract: string | null;
    chain_id: number;
    recipient_address: string;
    arena_slug: string;
    arena_name: string;
  };

  await trackEvent('prena_payment_started', {
    builderId: input.builderId,
    arenaId: input.arenaId,
    projectId: input.projectId,
    payload: { chainId: payload.chain_id, mode: prenaServerConfig.mode },
  });

  return {
    ok: true,
    intent: {
      tokenPaymentId: payload.token_payment_id,
      entryId: payload.entry_id,
      tokenAmount: parseBaseUnits(payload.token_amount).toString(),
      tokenAmountFormatted: formatTokenAmount(parseBaseUnits(payload.token_amount), payload.token_decimals),
      tokenDecimals: payload.token_decimals,
      tokenContract: payload.token_contract,
      tokenSymbol: prenaServerConfig.tokenSymbol,
      chainId: payload.chain_id,
      recipientAddress: payload.recipient_address,
      arenaSlug: payload.arena_slug,
      arenaName: payload.arena_name,
      mode: prenaServerConfig.mode,
    },
  };
}

export interface VerifyResult {
  status: TokenPaymentStatus;
  entryId?: string;
  entryStatus?: string;
  overflow?: boolean;
  error?: string;
  retryable?: boolean;
}

export async function verifyPrenaPayment(input: {
  builderId: string;
  tokenPaymentId: string;
  txHash: string;
}): Promise<VerifyResult> {
  if (!isTxHashLike(input.txHash)) return { status: 'confirming', error: 'invalid_tx_hash' };

  const supabase = createAdminClient();
  if (!supabase) return { status: 'pending', error: 'not_configured' };

  const txHash = input.txHash.toLowerCase();

  // Records the hash. The unique index on (chain_id, tx_hash) is what stops the
  // same transaction from funding a second entry.
  const { error: attachError } = await supabase.rpc('attach_token_payment_tx', {
    p_token_payment_id: input.tokenPaymentId,
    p_builder_id: input.builderId,
    p_tx_hash: txHash,
  });
  if (attachError) {
    const code = rpcError(attachError.message);
    if (code === 'duplicate_tx') {
      await failPayment(input.tokenPaymentId, 'tx_already_used');
      return { status: 'failed', error: 'tx_already_used' };
    }
    return { status: 'confirming', error: code };
  }

  const { data: paymentRow } = await supabase
    .from('token_payments')
    .select('*')
    .eq('id', input.tokenPaymentId)
    .maybeSingle();
  if (!paymentRow) return { status: 'failed', error: 'payment_not_found' };

  const payment = paymentRow as {
    builder_id: string;
    status: TokenPaymentStatus;
    chain_id: number;
    token_contract: string | null;
    token_amount: string;
    recipient_address: string | null;
    wallet_address: string;
  };

  if (payment.builder_id !== input.builderId) return { status: 'failed', error: 'forbidden' };
  if (payment.status === 'confirmed') {
    const { data: entry } = await supabase
      .from('arena_entries')
      .select('id, status')
      .eq('token_payment_id', input.tokenPaymentId)
      .maybeSingle();
    return {
      status: 'confirmed',
      entryId: (entry as { id: string } | null)?.id,
      entryStatus: (entry as { status: string } | null)?.status,
    };
  }

  const expectedRecipient = payment.recipient_address ?? paymentRecipient();
  if (!expectedRecipient) return { status: 'confirming', error: 'treasury_not_configured' };

  let transfer;
  try {
    transfer = await chainProvider().getTokenTransfer(txHash, expectedRecipient);
  } catch (error) {
    const code = error instanceof ChainError ? error.code : 'rpc_unavailable';
    if (code === 'tx_pending' || code === 'tx_not_found' || code === 'rpc_unavailable') {
      // Still settling or the node is behind. Keep the hold and let the client poll.
      return { status: 'confirming', error: code, retryable: true };
    }
    await failPayment(input.tokenPaymentId, code);
    return { status: 'failed', error: code };
  }

  // Every field is checked against what the server itself recorded. A quote
  // amount that will not parse exactly is a bug, not an underpayment to accept.
  let expectedAmount: bigint;
  let paidAmount: bigint;
  try {
    expectedAmount = parseBaseUnits(payment.token_amount);
    paidAmount = parseBaseUnits(transfer.amount);
  } catch {
    await failPayment(input.tokenPaymentId, 'amount_unreadable');
    return { status: 'failed', error: 'payment_failed' };
  }
  const checks: Array<[boolean, string]> = [
    [transfer.success, 'tx_reverted'],
    [transfer.chainId === payment.chain_id, 'wrong_chain'],
    [transfer.to.toLowerCase() === expectedRecipient, 'wrong_recipient'],
    [transfer.from.toLowerCase() === payment.wallet_address, 'wrong_sender'],
    [
      !payment.token_contract || (transfer.tokenContract ?? '').toLowerCase() === payment.token_contract,
      'wrong_token',
    ],
    [paidAmount >= expectedAmount, 'amount_too_low'],
  ];
  const failed = checks.find(([passed]) => !passed);
  if (failed) {
    await failPayment(input.tokenPaymentId, failed[1]);
    await trackEvent('prena_payment_failed', {
      builderId: input.builderId,
      payload: { reason: failed[1] },
    });
    return { status: 'failed', error: failed[1] };
  }

  const { data: confirmed, error: confirmError } = await supabase.rpc('confirm_prena_entry', {
    p_token_payment_id: input.tokenPaymentId,
    p_tx_hash: txHash,
  });
  if (confirmError) return { status: 'confirming', error: rpcError(confirmError.message), retryable: true };

  const result = confirmed as { entry_id: string; status: string; overflow?: boolean };
  return {
    status: result.overflow ? 'refunded' : 'confirmed',
    entryId: result.entry_id,
    entryStatus: result.status,
    overflow: Boolean(result.overflow),
  };
}

/**
 * Mock-mode settlement. Stands in for the wallet transaction so the whole flow
 * is exercisable before the token exists. Refuses to run in onchain mode.
 */
export async function simulatePrenaPayment(input: {
  builderId: string;
  tokenPaymentId: string;
}): Promise<VerifyResult> {
  if (prenaServerConfig.mode !== 'mock') return { status: 'failed', error: 'mock_only' };
  const txHash = mockTxHash(`${input.tokenPaymentId}:${input.builderId}`);
  return verifyPrenaPayment({ ...input, txHash });
}

export async function failPayment(tokenPaymentId: string, reason: string, status: 'failed' | 'expired' = 'failed') {
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.rpc('fail_token_payment', {
    p_token_payment_id: tokenPaymentId,
    p_reason: reason,
    p_status: status,
  });
}

export async function getTokenPayment(builderId: string, tokenPaymentId: string) {
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('token_payments')
    .select('*, arenas:arena_id(name, slug), arena_entries:arena_entries!arena_entries_token_payment_id_fkey(id, status)')
    .eq('id', tokenPaymentId)
    .eq('builder_id', builderId)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

/** Where entry payments are sent. Configurable; never a hard-coded address. */
export function paymentRecipient(): string | null {
  if (prenaServerConfig.treasuryAddress) return prenaServerConfig.treasuryAddress;
  // Mock mode has no real treasury; use a deterministic non-custodial sentinel
  // so the flow is complete without pretending a production address exists.
  if (prenaServerConfig.mode === 'mock') return '0x00000000000000000000000000000000000a4e4a';
  return null;
}

function rpcError(message: string | null | undefined): string {
  const text = message ?? '';
  if (text.includes('token_payments_tx_unique') || text.includes('duplicate key')) return 'duplicate_tx';
  const known = [
    'arena_not_found',
    'prena_entry_disabled',
    'arena_full',
    'arena_closed',
    'registration_not_open',
    'registration_closed',
    'quote_not_found',
    'quote_mismatch',
    'quote_consumed',
    'quote_expired',
    'not_project_owner',
    'wallet_not_verified',
    'already_entered',
    'payment_not_found',
    'payment_closed',
    'tx_already_attached',
    'forbidden',
  ];
  return known.find((code) => text.includes(code)) ?? 'payment_failed';
}
