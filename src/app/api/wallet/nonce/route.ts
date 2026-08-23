import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';
import { createWalletChallenge } from '@/services/wallet';
import { rateLimit } from '@/lib/prena/rate-limit';
import { prenaServerConfig } from '@/lib/prena/config';

const Body = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  chainId: z.number().int().positive().optional(),
  purpose: z.enum(['link', 'claim']).default('link'),
  allocationId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  if (!rateLimit(`nonce:${ctx.builder.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const result = await createWalletChallenge({
    builderId: ctx.builder.id,
    address: parsed.data.address,
    chainId: parsed.data.chainId ?? prenaServerConfig.chainId,
    purpose: parsed.data.purpose,
    allocationId: parsed.data.allocationId ?? null,
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'rate_limited' ? 429 : 400 });
  }

  if (parsed.data.purpose === 'link') {
    await trackEvent('wallet_connect_started', { builderId: ctx.builder.id });
  }

  return NextResponse.json(result);
}
