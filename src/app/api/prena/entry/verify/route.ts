import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder } from '@/lib/auth';
import { simulatePrenaPayment, verifyPrenaPayment } from '@/services/tokenPayment';
import { rateLimit } from '@/lib/prena/rate-limit';
import { prenaServerConfig } from '@/lib/prena/config';

const Body = z.object({
  tokenPaymentId: z.string().uuid(),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
  /** Mock mode only: stands in for the wallet transaction. */
  simulate: z.boolean().optional(),
});

/**
 * Server-side verification. The Arena Entry is only created here, after the
 * chain has been re-read independently of anything the frontend claimed.
 */
export async function POST(request: Request) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  if (!rateLimit(`prena-verify:${ctx.builder.id}`, 60, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  if (parsed.data.simulate) {
    if (prenaServerConfig.mode !== 'mock') {
      return NextResponse.json({ error: 'mock_only' }, { status: 400 });
    }
    const simulated = await simulatePrenaPayment({
      builderId: ctx.builder.id,
      tokenPaymentId: parsed.data.tokenPaymentId,
    });
    return NextResponse.json(simulated);
  }

  if (!parsed.data.txHash) return NextResponse.json({ error: 'tx_hash_required' }, { status: 400 });

  const result = await verifyPrenaPayment({
    builderId: ctx.builder.id,
    tokenPaymentId: parsed.data.tokenPaymentId,
    txHash: parsed.data.txHash,
  });

  return NextResponse.json(result);
}
