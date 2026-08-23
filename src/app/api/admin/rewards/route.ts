import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder, userIsAdmin } from '@/lib/auth';
import {
  calculateArenaRewards,
  setArenaRewardStatus,
  settleRewardClaim,
} from '@/services/rewards';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('calculate'), arenaId: z.string().uuid() }),
  z.object({ action: z.literal('approve'), arenaId: z.string().uuid() }),
  z.object({ action: z.literal('publish'), arenaId: z.string().uuid() }),
  z.object({ action: z.literal('cancel'), arenaId: z.string().uuid() }),
  z.object({
    action: z.literal('settle'),
    allocationId: z.string().uuid(),
    txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  }),
]);

export async function POST(request: Request) {
  const ctx = await getBuilder();
  if (!ctx || !(await userIsAdmin(ctx.userId, ctx.email))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const body = parsed.data;

  if (body.action === 'calculate') {
    const result = await calculateArenaRewards(body.arenaId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json(result);
  }
  if (body.action === 'approve') {
    return NextResponse.json({ updated: await setArenaRewardStatus(body.arenaId, 'pending', 'approved') });
  }
  if (body.action === 'publish') {
    return NextResponse.json({ updated: await setArenaRewardStatus(body.arenaId, 'approved', 'claimable') });
  }
  if (body.action === 'cancel') {
    const pending = await setArenaRewardStatus(body.arenaId, 'pending', 'cancelled');
    const approved = await setArenaRewardStatus(body.arenaId, 'approved', 'cancelled');
    return NextResponse.json({ updated: pending + approved });
  }

  await settleRewardClaim(body.allocationId, body.txHash);
  return NextResponse.json({ ok: true });
}
