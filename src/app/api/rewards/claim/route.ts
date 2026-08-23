import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder } from '@/lib/auth';
import { claimReward } from '@/services/rewards';
import { rateLimit } from '@/lib/prena/rate-limit';
import { prenaErrorStatus } from '@/lib/prena/errors';

const Body = z.object({
  allocationId: z.string().uuid(),
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  nonce: z.string().min(16).max(128),
  message: z.string().min(1).max(2000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(2000),
});


export async function POST(request: Request) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  if (!rateLimit(`claim:${ctx.builder.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const result = await claimReward({ builderId: ctx.builder.id, ...parsed.data });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: prenaErrorStatus(result.error) });

  return NextResponse.json(result);
}
