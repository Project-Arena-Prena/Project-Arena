import { createAdminClient } from '@/lib/supabase/server';
import { calculateArenaRewards } from './rewards';

/**
 * Background $PRENA maintenance, run from the reconcile cron.
 *
 * Both steps are deliberately conservative: expiring a hold never touches a
 * confirmed payment, and reward generation only produces `pending` allocations
 * that an admin still has to approve and publish before anyone can claim.
 */

/** Releases Arena slots held by abandoned token payments. */
export async function expireStaleTokenPayments(): Promise<number> {
  const supabase = createAdminClient();
  if (!supabase) return 0;
  const { data } = await supabase.rpc('expire_token_payments');
  return Number(data ?? 0);
}

/**
 * Generates pending allocations for finished Arenas whose reward pool has not
 * been evaluated yet. Reads frozen final rankings only.
 */
export async function generatePendingArenaRewards(): Promise<{ arenas: number; created: number }> {
  const supabase = createAdminClient();
  if (!supabase) return { arenas: 0, created: 0 };

  const { data } = await supabase
    .from('arena_reward_pools')
    .select('arena_id, status, arenas:arena_id(status, reward_pool_enabled)')
    .in('status', ['draft', 'announced', 'locked'])
    .limit(20);

  let arenas = 0;
  let created = 0;
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const arena = (row.arenas ?? {}) as { status?: string; reward_pool_enabled?: boolean };
    if (arena.status !== 'finished' || !arena.reward_pool_enabled) continue;
    const result = await calculateArenaRewards(String(row.arena_id));
    if (result.ok) {
      arenas += 1;
      created += result.created;
    }
  }
  return { arenas, created };
}
