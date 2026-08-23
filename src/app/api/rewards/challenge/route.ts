import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder } from '@/lib/auth';
import { createWalletChallenge, getBuilderWallets } from '@/services/wallet';
import { listBuilderRewards } from '@/services/rewards';
import { rateLimit } from '@/lib/prena/rate-limit';
import { prenaServerConfig } from '@/lib/prena/config';

const Body = z.object({ allocationId: z.string().uuid() });

/**
 * Issues the claim challenge. A reward can only be claimed with a fresh
 * signature from the wallet the allocation is addressed to, so a hijacked
 * session alone cannot redirect a payout.
 */
export async function POST(request: Request) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  if (!rateLimit(`claim-challenge:${ctx.builder.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const rewards = await listBuilderRewards(ctx.builder.id, ['claimable']);
  const allocation = rewards.find((item) => item.id === parsed.data.allocationId);
  if (!allocation) return NextResponse.json({ error: 'not_claimable' }, { status: 409 });

  const wallets = await getBuilderWallets(ctx.builder.id);
  const target = allocation.walletAddress
    ? wallets.find((wallet) => wallet.address === allocation.walletAddress && wallet.verifiedAt)
    : wallets.find((wallet) => wallet.verifiedAt);
  if (!target) {
    return NextResponse.json(
      { error: allocation.walletAddress ? 'wallet_mismatch' : 'wallet_not_linked', expected: allocation.walletAddress },
      { status: 409 },
    );
  }

  const challenge = await createWalletChallenge({
    builderId: ctx.builder.id,
    address: target.address,
    chainId: target.chainId ?? prenaServerConfig.chainId,
    purpose: 'claim',
    allocationId: allocation.id,
    detail: `${allocation.amountFormatted} ${allocation.tokenSymbol} — ${allocation.arenaName}`,
  });
  if ('error' in challenge) return NextResponse.json({ error: challenge.error }, { status: 400 });

  return NextResponse.json({ ...challenge, address: target.address, chainId: target.chainId });
}
