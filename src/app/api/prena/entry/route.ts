import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';
import { reconcileArenas } from '@/lib/arena-lifecycle';
import { getArena } from '@/lib/queries';
import { createPrenaPaymentIntent } from '@/services/tokenPayment';
import { rateLimit } from '@/lib/prena/rate-limit';
import { prenaErrorStatus } from '@/lib/prena/errors';

const Body = z.object({
  arenaSlug: z.string().min(1).max(80),
  projectId: z.string().uuid(),
  quoteId: z.string().uuid(),
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});


export async function POST(request: Request) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  if (!rateLimit(`prena-entry:${ctx.builder.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  await reconcileArenas();
  const arena = await getArena(parsed.data.arenaSlug);
  if (!arena) return NextResponse.json({ error: 'arena_not_found' }, { status: 404 });

  const result = await createPrenaPaymentIntent({
    builderId: ctx.builder.id,
    arenaId: arena.id,
    projectId: parsed.data.projectId,
    quoteId: parsed.data.quoteId,
    walletAddress: parsed.data.walletAddress,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: prenaErrorStatus(result.error) });

  await trackEvent('prena_entry_selected', {
    builderId: ctx.builder.id,
    arenaId: arena.id,
    projectId: parsed.data.projectId,
  });

  return NextResponse.json({ intent: result.intent });
}
