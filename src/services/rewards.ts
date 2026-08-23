import { createAdminClient } from '@/lib/supabase/server';
import { prenaServerConfig } from '@/lib/prena/config';
import { formatDisplayAmount } from '@/lib/prena/amount';
import { trackEvent } from '@/lib/analytics';
import { mockTxHash } from './chain';
import { consumeWalletChallenge, walletBelongsToBuilder } from './wallet';

/**
 * Arena reward pools, allocation, and claiming.
 *
 * Rank is produced entirely by the Arena scoring system. This module only reads
 * frozen final_rank values and maps them onto a configured reward structure —
 * it never writes a score, a rank, or a rating.
 */

export type RewardType = 'champion' | 'rank' | 'percentile' | 'supporter' | 'community' | 'special';
export type AllocationStatus = 'pending' | 'approved' | 'claimable' | 'claimed' | 'cancelled';
export type PoolStatus = 'draft' | 'announced' | 'locked' | 'allocated' | 'distributed' | 'cancelled';

export interface RewardTier {
  id: string;
  rewardType: RewardType;
  label: string;
  rankStart: number | null;
  rankEnd: number | null;
  percentileStart: number | null;
  percentileEnd: number | null;
  amount: string | null;
  percentage: number | null;
  distribution: 'split' | 'each';
  position: number;
}

export interface ArenaRewardPool {
  id: string;
  arenaId: string;
  tokenSymbol: string;
  tokenContract: string | null;
  chainId: number | null;
  totalAmount: string;
  totalAmountFormatted: string;
  status: PoolStatus;
  tiers: RewardTier[];
}

export interface RewardAllocation {
  id: string;
  arenaId: string;
  arenaName: string;
  arenaSlug: string;
  projectId: string;
  projectName: string;
  builderId: string | null;
  walletAddress: string | null;
  rewardType: RewardType;
  label: string;
  finalRank: number | null;
  amount: string;
  amountFormatted: string;
  tokenSymbol: string;
  status: AllocationStatus;
  claimTxHash: string | null;
  createdAt: string;
  claimedAt: string | null;
}

export async function getArenaRewardPool(arenaId: string): Promise<ArenaRewardPool | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('arena_reward_pools')
    .select('*, arena_reward_tiers(*)')
    .eq('arena_id', arenaId)
    .maybeSingle();
  return data ? toPool(data as Record<string, unknown>) : null;
}


export async function upsertArenaRewardPool(input: {
  arenaId: string;
  totalAmount: string | number;
  status?: PoolStatus;
  tokenSymbol?: string;
  notes?: string | null;
}): Promise<ArenaRewardPool | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;
  await supabase.from('arena_reward_pools').upsert(
    {
      arena_id: input.arenaId,
      total_amount: String(input.totalAmount),
      token_symbol: input.tokenSymbol ?? prenaServerConfig.tokenSymbol,
      token_contract: prenaServerConfig.tokenAddress,
      chain_id: prenaServerConfig.chainId,
      status: input.status ?? 'announced',
      notes: input.notes ?? null,
    },
    { onConflict: 'arena_id' },
  );
  return getArenaRewardPool(input.arenaId);
}

export async function replaceRewardTiers(
  poolId: string,
  tiers: Array<{
    rewardType: RewardType;
    label?: string;
    rankStart?: number | null;
    rankEnd?: number | null;
    percentileStart?: number | null;
    percentileEnd?: number | null;
    amount?: string | number | null;
    percentage?: number | null;
    distribution?: 'split' | 'each';
  }>,
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.from('arena_reward_tiers').delete().eq('reward_pool_id', poolId);
  if (tiers.length === 0) return;
  await supabase.from('arena_reward_tiers').insert(
    tiers.map((tier, index) => ({
      reward_pool_id: poolId,
      reward_type: tier.rewardType,
      label: tier.label ?? '',
      rank_start: tier.rankStart ?? null,
      rank_end: tier.rankEnd ?? null,
      percentile_start: tier.percentileStart ?? null,
      percentile_end: tier.percentileEnd ?? null,
      amount: tier.amount == null ? null : String(tier.amount),
      percentage: tier.percentage ?? null,
      distribution: tier.distribution ?? 'split',
      position: index,
    })),
  );
}

/** Runs after an Arena is finished and its ranking is frozen. */
export async function calculateArenaRewards(
  arenaId: string,
): Promise<{ ok: true; created: number; allocated: string; reserved: string } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const { data, error } = await supabase.rpc('generate_arena_reward_allocations', { p_arena_id: arenaId });
  if (error) {
    const known = [
      'arena_not_found',
      'arena_not_finished',
      'reward_pool_not_found',
      'reward_pool_disabled',
      'reward_pool_closed',
      'no_final_standings',
    ];
    return { ok: false, error: known.find((code) => (error.message ?? '').includes(code)) ?? 'calculation_failed' };
  }
  const payload = data as { created: number; allocated: string; reserved: string };
  return {
    ok: true,
    created: Number(payload.created ?? 0),
    allocated: String(payload.allocated ?? '0'),
    reserved: String(payload.reserved ?? '0'),
  };
}

export async function setArenaRewardStatus(
  arenaId: string,
  from: AllocationStatus,
  to: 'approved' | 'claimable' | 'cancelled',
): Promise<number> {
  const supabase = createAdminClient();
  if (!supabase) return 0;
  const { data } = await supabase.rpc('set_arena_reward_status', {
    p_arena_id: arenaId,
    p_from: from,
    p_to: to,
  });
  return Number(data ?? 0);
}


export async function listBuilderRewards(
  builderId: string,
  statuses?: AllocationStatus[],
): Promise<RewardAllocation[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  let query = supabase
    .from('reward_allocations')
    .select('*, arenas:arena_id(name, slug), projects:project_id(name)')
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false });
  if (statuses?.length) query = query.in('status', statuses);
  const { data } = await query;
  return ((data ?? []) as Array<Record<string, unknown>>).map(toAllocation);
}

export async function listArenaAllocations(arenaId: string): Promise<RewardAllocation[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('reward_allocations')
    .select('*, arenas:arena_id(name, slug), projects:project_id(name)')
    .eq('arena_id', arenaId)
    .order('final_rank', { ascending: true });
  return ((data ?? []) as Array<Record<string, unknown>>).map(toAllocation);
}

export type ClaimResult =
  | { ok: true; allocationId: string; amount: string; txHash: string | null; settled: boolean }
  | { ok: false; error: string };

/**
 * Claims one reward. Requires a fresh signature from a verified wallet, so a
 * stolen session alone cannot redirect a payout. The database guard makes
 * double-claiming impossible even under concurrent requests.
 */
export async function claimReward(input: {
  builderId: string;
  allocationId: string;
  walletAddress: string;
  nonce: string;
  message: string;
  signature: string;
}): Promise<ClaimResult> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const verified = await consumeWalletChallenge({
    builderId: input.builderId,
    nonce: input.nonce,
    message: input.message,
    signature: input.signature,
    purpose: 'claim',
  });
  if ('error' in verified) return { ok: false, error: verified.error };
  if (verified.allocationId && verified.allocationId !== input.allocationId) {
    return { ok: false, error: 'nonce_purpose_mismatch' };
  }
  if (verified.address !== input.walletAddress.toLowerCase()) return { ok: false, error: 'wallet_mismatch' };
  if (!(await walletBelongsToBuilder(input.builderId, verified.address))) {
    return { ok: false, error: 'wallet_not_verified' };
  }

  // Mock mode settles immediately with a labelled synthetic hash. Onchain mode
  // records the claim and leaves settlement to the configured distributor.
  const txHash =
    prenaServerConfig.mode === 'mock' ? mockTxHash(`claim:${input.allocationId}`) : null;

  const { data, error } = await supabase.rpc('claim_reward', {
    p_allocation_id: input.allocationId,
    p_builder_id: input.builderId,
    p_wallet_address: verified.address,
    p_signature: input.signature,
    p_tx_hash: txHash,
  });

  if (error) {
    const known = [
      'allocation_not_found',
      'forbidden',
      'already_claimed',
      'not_claimable',
      'wallet_not_verified',
      'wallet_mismatch',
    ];
    return { ok: false, error: known.find((code) => (error.message ?? '').includes(code)) ?? 'claim_failed' };
  }

  const payload = data as { allocation_id: string; amount: string };
  await trackEvent('reward_claim_started', { builderId: input.builderId, payload: { allocationId: input.allocationId } });

  return {
    ok: true,
    allocationId: payload.allocation_id,
    amount: String(payload.amount),
    txHash,
    settled: txHash !== null,
  };
}

/** Attaches a settled payout hash to an already-claimed allocation (admin). */
export async function settleRewardClaim(allocationId: string, txHash: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.rpc('settle_reward_claim', { p_allocation_id: allocationId, p_tx_hash: txHash.toLowerCase() });
}

export async function getBuilderPrenaSummary(builderId: string) {
  const supabase = createAdminClient();
  if (!supabase) {
    return { claimable: '0', pending: '0', earned: '0', claimed: '0', spent: '0' };
  }
  const { data } = await supabase.rpc('builder_prena_summary', { p_builder_id: builderId });
  const payload = (data ?? {}) as Record<string, string>;
  return {
    claimable: payload.claimable ?? '0',
    pending: payload.pending ?? '0',
    earned: payload.earned ?? '0',
    claimed: payload.claimed ?? '0',
    spent: payload.spent ?? '0',
  };
}

export async function getPrenaEconomyTotals() {
  const supabase = createAdminClient();
  const empty = {
    entryVolume: '0',
    tokenPayments: 0,
    openPayments: 0,
    failedPayments: 0,
    rewardsAllocated: '0',
    rewardsClaimed: '0',
    rewardsUnclaimed: '0',
    linkedWallets: 0,
    buildersWithWallets: 0,
  };
  if (!supabase) return empty;
  const { data } = await supabase.rpc('prena_economy_totals');
  return { ...empty, ...((data ?? {}) as Partial<typeof empty>) };
}

function toPool(row: Record<string, unknown>): ArenaRewardPool {
  const tierRows = Array.isArray(row.arena_reward_tiers) ? (row.arena_reward_tiers as Array<Record<string, unknown>>) : [];
  return {
    id: String(row.id),
    arenaId: String(row.arena_id),
    tokenSymbol: String(row.token_symbol ?? 'PRENA'),
    tokenContract: (row.token_contract as string | null) ?? null,
    chainId: row.chain_id == null ? null : Number(row.chain_id),
    totalAmount: String(row.total_amount ?? '0'),
    totalAmountFormatted: formatDisplayAmount(String(row.total_amount ?? '0')),
    status: String(row.status ?? 'draft') as PoolStatus,
    tiers: tierRows
      .map((tier) => ({
        id: String(tier.id),
        rewardType: String(tier.reward_type) as RewardType,
        label: String(tier.label ?? ''),
        rankStart: tier.rank_start == null ? null : Number(tier.rank_start),
        rankEnd: tier.rank_end == null ? null : Number(tier.rank_end),
        percentileStart: tier.percentile_start == null ? null : Number(tier.percentile_start),
        percentileEnd: tier.percentile_end == null ? null : Number(tier.percentile_end),
        amount: tier.amount == null ? null : String(tier.amount),
        percentage: tier.percentage == null ? null : Number(tier.percentage),
        distribution: (String(tier.distribution ?? 'split') as 'split' | 'each'),
        position: Number(tier.position ?? 0),
      }))
      .sort((a, b) => a.position - b.position),
  };
}

function toAllocation(row: Record<string, unknown>): RewardAllocation {
  const arena = (row.arenas ?? {}) as { name?: string; slug?: string };
  const project = (row.projects ?? {}) as { name?: string };
  const amount = String(row.amount ?? '0');
  return {
    id: String(row.id),
    arenaId: String(row.arena_id),
    arenaName: arena.name ?? 'Arena',
    arenaSlug: arena.slug ?? '',
    projectId: String(row.project_id),
    projectName: project.name ?? 'Project',
    builderId: (row.builder_id as string | null) ?? null,
    walletAddress: (row.wallet_address as string | null) ?? null,
    rewardType: String(row.reward_type) as RewardType,
    label: String(row.label ?? ''),
    finalRank: row.final_rank == null ? null : Number(row.final_rank),
    amount,
    amountFormatted: formatDisplayAmount(amount),
    tokenSymbol: String(row.token_symbol ?? 'PRENA'),
    status: String(row.status) as AllocationStatus,
    claimTxHash: (row.claim_tx_hash as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
    claimedAt: (row.claimed_at as string | null) ?? null,
  };
}
