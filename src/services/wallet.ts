import { randomBytes } from 'node:crypto';
import { verifyMessage } from 'viem';
import { createAdminClient } from '@/lib/supabase/server';
import { normalizeAddress, prenaServerConfig, isAddressLike } from '@/lib/prena/config';

/**
 * Wallet ↔ Builder linking.
 *
 * A wallet address arriving from the browser is never trusted. It is only
 * written after a signature over a server-issued, single-use, expiring nonce
 * recovers to that exact address.
 */

export interface BuilderWallet {
  id: string;
  builderId: string;
  address: string;
  chainId: number;
  isPrimary: boolean;
  verifiedAt: string | null;
  createdAt: string;
}

export type WalletPurpose = 'link' | 'claim';

const NONCE_TTL_MS = 5 * 60 * 1000;
/** Nonces a Builder may hold open at once — cheap rate limit on the challenge. */
const MAX_OPEN_NONCES = 5;

export interface WalletChallenge {
  nonce: string;
  message: string;
  expiresAt: string;
}

function challengeMessage(input: {
  address: string;
  chainId: number;
  nonce: string;
  purpose: WalletPurpose;
  issuedAt: string;
  detail?: string;
}): string {
  const lines = [
    'Project Arena',
    input.purpose === 'claim' ? 'Claim a $PRENA reward.' : 'Link this wallet to your Builder account.',
    '',
    'This signature proves you control this wallet. It does not move funds,',
    'grant spending approval, or affect any Arena score.',
    '',
    `Wallet: ${input.address}`,
    `Chain: ${input.chainId}`,
  ];
  if (input.detail) lines.push(`Reward: ${input.detail}`);
  lines.push(`Nonce: ${input.nonce}`, `Issued: ${input.issuedAt}`);
  return lines.join('\n');
}

export async function createWalletChallenge(input: {
  builderId: string;
  address: string;
  chainId: number;
  purpose?: WalletPurpose;
  allocationId?: string | null;
  detail?: string;
}): Promise<WalletChallenge | { error: string }> {
  const address = normalizeAddress(input.address);
  if (!address) return { error: 'invalid_address' };

  const supabase = createAdminClient();
  if (!supabase) return { error: 'not_configured' };

  const purpose: WalletPurpose = input.purpose ?? 'link';

  const { count } = await supabase
    .from('wallet_nonces')
    .select('id', { count: 'exact', head: true })
    .eq('builder_id', input.builderId)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString());
  if ((count ?? 0) >= MAX_OPEN_NONCES) return { error: 'rate_limited' };

  const nonce = randomBytes(24).toString('hex');
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString();

  const { error } = await supabase.from('wallet_nonces').insert({
    builder_id: input.builderId,
    nonce,
    purpose,
    wallet_address: address,
    chain_id: input.chainId,
    allocation_id: input.allocationId ?? null,
    expires_at: expiresAt,
  });
  if (error) return { error: 'nonce_failed' };

  return {
    nonce,
    expiresAt,
    message: challengeMessage({ address, chainId: input.chainId, nonce, purpose, issuedAt, detail: input.detail }),
  };
}

export interface VerifiedChallenge {
  address: string;
  chainId: number;
  allocationId: string | null;
}

/**
 * Consumes a nonce and verifies the signature recovers to the declared address.
 * Single-use: the nonce row is marked consumed before the caller acts on it, so
 * a replayed signature finds nothing to consume.
 */
export async function consumeWalletChallenge(input: {
  builderId: string;
  nonce: string;
  message: string;
  signature: string;
  purpose?: WalletPurpose;
}): Promise<VerifiedChallenge | { error: string }> {
  const supabase = createAdminClient();
  if (!supabase) return { error: 'not_configured' };

  const { data } = await supabase
    .from('wallet_nonces')
    .select('id, builder_id, wallet_address, chain_id, purpose, allocation_id, expires_at, consumed_at')
    .eq('nonce', input.nonce)
    .maybeSingle();

  if (!data) return { error: 'nonce_not_found' };
  const row = data as {
    id: string;
    builder_id: string;
    wallet_address: string | null;
    chain_id: number | null;
    purpose: string;
    allocation_id: string | null;
    expires_at: string;
    consumed_at: string | null;
  };

  if (row.builder_id !== input.builderId) return { error: 'forbidden' };
  if (row.consumed_at) return { error: 'nonce_used' };
  if (Date.parse(row.expires_at) <= Date.now()) return { error: 'nonce_expired' };
  if (input.purpose && row.purpose !== input.purpose) return { error: 'nonce_purpose_mismatch' };
  if (!row.wallet_address) return { error: 'nonce_invalid' };
  // The message must be the one that was issued, not one the client composed.
  if (!input.message.includes(input.nonce)) return { error: 'message_mismatch' };
  if (!input.message.toLowerCase().includes(row.wallet_address)) return { error: 'message_mismatch' };

  // Claim the nonce first. A concurrent replay loses this update and stops here.
  const { data: claimed } = await supabase
    .from('wallet_nonces')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();
  if (!claimed) return { error: 'nonce_used' };

  let valid = false;
  try {
    valid = await verifyMessage({
      address: row.wallet_address as `0x${string}`,
      message: input.message,
      signature: input.signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }
  if (!valid) return { error: 'bad_signature' };

  return {
    address: row.wallet_address,
    chainId: row.chain_id ?? prenaServerConfig.chainId,
    allocationId: row.allocation_id,
  };
}

export async function linkWallet(input: {
  builderId: string;
  address: string;
  chainId: number;
}): Promise<BuilderWallet | { error: string }> {
  const address = normalizeAddress(input.address);
  if (!address) return { error: 'invalid_address' };

  const supabase = createAdminClient();
  if (!supabase) return { error: 'not_configured' };

  const { data: existing } = await supabase
    .from('builder_wallets')
    .select('id, builder_id')
    .eq('wallet_address', address)
    .maybeSingle();

  if (existing && (existing as { builder_id: string }).builder_id !== input.builderId) {
    return { error: 'wallet_taken' };
  }

  const { count } = await supabase
    .from('builder_wallets')
    .select('id', { count: 'exact', head: true })
    .eq('builder_id', input.builderId);

  const payload = {
    builder_id: input.builderId,
    wallet_address: address,
    chain_id: input.chainId,
    verified_at: new Date().toISOString(),
    is_primary: (count ?? 0) === 0,
  };

  const { data, error } = existing
    ? await supabase
        .from('builder_wallets')
        .update({ chain_id: input.chainId, verified_at: payload.verified_at })
        .eq('id', (existing as { id: string }).id)
        .select('*')
        .single()
    : await supabase.from('builder_wallets').insert(payload).select('*').single();

  if (error || !data) return { error: 'link_failed' };
  return toBuilderWallet(data as Record<string, unknown>);
}

export async function unlinkWallet(builderId: string, walletId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = createAdminClient();
  if (!supabase) return { error: 'not_configured' };

  const { data: wallet } = await supabase
    .from('builder_wallets')
    .select('id, builder_id, wallet_address')
    .eq('id', walletId)
    .maybeSingle();
  if (!wallet) return { error: 'not_found' };
  if ((wallet as { builder_id: string }).builder_id !== builderId) return { error: 'forbidden' };

  const address = (wallet as { wallet_address: string }).wallet_address;

  // An unclaimed reward is addressed to this wallet. Unlinking would strip the
  // destination, so it stays until the reward is claimed or cancelled.
  const { count: openRewards } = await supabase
    .from('reward_allocations')
    .select('id', { count: 'exact', head: true })
    .eq('wallet_address', address)
    .in('status', ['pending', 'approved', 'claimable']);
  if ((openRewards ?? 0) > 0) return { error: 'reward_pending' };

  const { count: openPayments } = await supabase
    .from('token_payments')
    .select('id', { count: 'exact', head: true })
    .eq('wallet_address', address)
    .in('status', ['pending', 'confirming']);
  if ((openPayments ?? 0) > 0) return { error: 'payment_pending' };

  await supabase.from('builder_wallets').delete().eq('id', walletId);

  // Promote a remaining wallet so the Builder always has a primary.
  const { data: remaining } = await supabase
    .from('builder_wallets')
    .select('id')
    .eq('builder_id', builderId)
    .order('created_at', { ascending: true })
    .limit(1);
  const next = (remaining ?? [])[0] as { id: string } | undefined;
  if (next) await supabase.from('builder_wallets').update({ is_primary: true }).eq('id', next.id);

  return { ok: true };
}

export async function getBuilderWallets(builderId: string): Promise<BuilderWallet[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('builder_wallets')
    .select('*')
    .eq('builder_id', builderId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  return ((data ?? []) as Array<Record<string, unknown>>).map(toBuilderWallet);
}

export async function getPrimaryWallet(builderId: string): Promise<BuilderWallet | null> {
  const wallets = await getBuilderWallets(builderId);
  return wallets.find((wallet) => wallet.verifiedAt) ?? null;
}

/** True only when this exact address is a verified wallet of this Builder. */
export async function walletBelongsToBuilder(builderId: string, address: string): Promise<boolean> {
  const normalized = normalizeAddress(address);
  if (!normalized) return false;
  const supabase = createAdminClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from('builder_wallets')
    .select('id')
    .eq('builder_id', builderId)
    .eq('wallet_address', normalized)
    .not('verified_at', 'is', null)
    .maybeSingle();
  return Boolean(data);
}

export function toBuilderWallet(row: Record<string, unknown>): BuilderWallet {
  return {
    id: String(row.id),
    builderId: String(row.builder_id),
    address: String(row.wallet_address),
    chainId: Number(row.chain_id ?? prenaServerConfig.chainId),
    isPrimary: Boolean(row.is_primary),
    verifiedAt: (row.verified_at as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export { isAddressLike };
