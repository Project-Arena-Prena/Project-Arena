import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder, userIsAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { replaceRewardTiers, upsertArenaRewardPool } from '@/services/rewards';

const Tier = z.object({
  rewardType: z.enum(['champion', 'rank', 'percentile', 'supporter', 'community', 'special']),
  label: z.string().max(60).optional(),
  rankStart: z.number().int().positive().nullable().optional(),
  rankEnd: z.number().int().positive().nullable().optional(),
  percentileStart: z.number().min(0).max(1).nullable().optional(),
  percentileEnd: z.number().min(0).max(1).nullable().optional(),
  amount: z.number().min(0).nullable().optional(),
  percentage: z.number().min(0).max(100).nullable().optional(),
  distribution: z.enum(['split', 'each']).optional(),
});

const Body = z.object({
  prenaPaymentEnabled: z.boolean().optional(),
  prenaDiscountPercent: z.number().int().min(0).max(90).optional(),
  prenaEarlyRegistrationAt: z.string().nullable().optional(),
  rewardPoolEnabled: z.boolean().optional(),
  rewardPoolAmount: z.number().min(0).optional(),
  rewardPoolStatus: z.enum(['draft', 'announced', 'locked', 'allocated', 'distributed', 'cancelled']).optional(),
  tiers: z.array(Tier).max(24).optional(),
});

/** Arena-level $PRENA settings. Contract addresses are inherited from config. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getBuilder();
  if (!ctx || !(await userIsAdmin(ctx.userId, ctx.email))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const patch: Record<string, unknown> = {};
  if (parsed.data.prenaPaymentEnabled !== undefined) patch.prena_payment_enabled = parsed.data.prenaPaymentEnabled;
  if (parsed.data.prenaDiscountPercent !== undefined) patch.prena_discount_percent = parsed.data.prenaDiscountPercent;
  if (parsed.data.rewardPoolEnabled !== undefined) patch.reward_pool_enabled = parsed.data.rewardPoolEnabled;
  if (parsed.data.prenaEarlyRegistrationAt !== undefined) {
    patch.prena_early_registration_at = parsed.data.prenaEarlyRegistrationAt;
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('arenas').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (parsed.data.rewardPoolAmount !== undefined || parsed.data.tiers) {
    const pool = await upsertArenaRewardPool({
      arenaId: id,
      totalAmount: parsed.data.rewardPoolAmount ?? 0,
      status: parsed.data.rewardPoolStatus,
    });
    if (pool && parsed.data.tiers) await replaceRewardTiers(pool.id, parsed.data.tiers);
  }

  return NextResponse.json({ ok: true });
}
