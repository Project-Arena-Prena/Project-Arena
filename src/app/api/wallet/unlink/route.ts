import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';
import { unlinkWallet } from '@/services/wallet';

const Body = z.object({ walletId: z.string().uuid() });

const STATUS: Record<string, number> = {
  forbidden: 403,
  not_found: 404,
  reward_pending: 409,
  payment_pending: 409,
};

export async function POST(request: Request) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const result = await unlinkWallet(ctx.builder.id, parsed.data.walletId);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: STATUS[result.error] ?? 400 });

  await trackEvent('wallet_unlinked', { builderId: ctx.builder.id });
  return NextResponse.json({ ok: true });
}
