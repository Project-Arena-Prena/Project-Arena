import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder, builderOwnsProject } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';
import { reconcileArenas } from '@/lib/arena-lifecycle';
import { getArena } from '@/lib/queries';
import { getPrenaQuote } from '@/services/tokenQuote';
import { rateLimit } from '@/lib/prena/rate-limit';
import { prenaIsConfigured, prenaConfigGaps } from '@/lib/prena/config';

const Body = z.object({
  arenaSlug: z.string().min(1).max(80),
  projectId: z.string().uuid().optional(),
});

/**
 * The only source of a spendable token amount. Pricing inputs come from the
 * Arena row; the conversion comes from the configured price source. Nothing the
 * browser sends influences the amount.
 */
export async function POST(request: Request) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  if (!rateLimit(`quote:${ctx.builder.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  if (!prenaIsConfigured()) {
    return NextResponse.json({ error: 'prena_not_configured', missing: prenaConfigGaps() }, { status: 503 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  await reconcileArenas();
  const arena = await getArena(parsed.data.arenaSlug);
  if (!arena) return NextResponse.json({ error: 'arena_not_found' }, { status: 404 });
  if (!arena.prenaPaymentEnabled) return NextResponse.json({ error: 'prena_entry_disabled' }, { status: 409 });
  if (arena.status !== 'registration') {
    return NextResponse.json({ error: arena.status === 'full' ? 'arena_full' : 'arena_closed' }, { status: 409 });
  }

  if (parsed.data.projectId && !(await builderOwnsProject(ctx.builder.id, parsed.data.projectId))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const result = await getPrenaQuote({
    builderId: ctx.builder.id,
    arenaId: arena.id,
    projectId: parsed.data.projectId ?? null,
    usdAmountCents: arena.entryFeeCents,
    discountPercent: arena.prenaDiscountPercent,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'price_unavailable' ? 503 : 400 });
  }

  await trackEvent('prena_quote_created', {
    builderId: ctx.builder.id,
    arenaId: arena.id,
    projectId: parsed.data.projectId ?? null,
    payload: { discountPercent: result.quote.discountPercent },
  });

  return NextResponse.json({ quote: result.quote });
}
