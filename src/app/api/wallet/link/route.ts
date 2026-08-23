import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';
import { consumeWalletChallenge, linkWallet } from '@/services/wallet';
import { rateLimit } from '@/lib/prena/rate-limit';
import { prenaErrorStatus } from '@/lib/prena/errors';

const Body = z.object({
  nonce: z.string().min(16).max(128),
  message: z.string().min(1).max(2000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(2000),
});


export async function POST(request: Request) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  if (!rateLimit(`link:${ctx.builder.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  // The address is taken from the verified challenge, never from the request.
  const verified = await consumeWalletChallenge({
    builderId: ctx.builder.id,
    nonce: parsed.data.nonce,
    message: parsed.data.message,
    signature: parsed.data.signature,
    purpose: 'link',
  });
  if ('error' in verified) {
    await trackEvent('wallet_link_failed', { builderId: ctx.builder.id, payload: { reason: verified.error } });
    return NextResponse.json({ error: verified.error }, { status: prenaErrorStatus(verified.error) });
  }

  const linked = await linkWallet({
    builderId: ctx.builder.id,
    address: verified.address,
    chainId: verified.chainId,
  });
  if ('error' in linked) {
    return NextResponse.json({ error: linked.error }, { status: prenaErrorStatus(linked.error) });
  }

  await trackEvent('wallet_connected', {
    builderId: ctx.builder.id,
    payload: { chainId: linked.chainId },
  });

  return NextResponse.json({ wallet: linked });
}
