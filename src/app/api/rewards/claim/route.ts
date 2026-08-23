import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder } from '@/lib/auth';
import { claimReward } from '@/services/rewards';
import { rateLimit } from '@/lib/prena/rate-limit';

const Body = z.object({
  allocationId: z.string().uuid(),
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  nonce: z.string().min(16).max(128),
  message: z.string().min(1).max(2000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(2000),
});

const STATUS: Record<string, number> = {
  forbidden: 403,
  wallet_not_verified: 403,
  wallet_mismatch: 409,
  already_claimed: 409,
  not_claimable: 409,
  allocation_not_found: 404,
  nonce_expired: 410,
  nonce_used: 409,
  bad_signature: 400,
};

export async function POST(request: Request) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  if (!rateLimit(`claim:${ctx.builder.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const result = await claimReward({ builderId: ctx.builder.id, ...parsed.data });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: STATUS[result.error] ?? 400 });

  return NextResponse.json(result);
}
