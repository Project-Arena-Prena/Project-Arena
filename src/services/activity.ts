import { createAdminClient } from '@/lib/supabase/server';
import { formatDisplayAmount } from '@/lib/prena/amount';

/**
 * $PRENA activity is derived from token_payments and reward_allocations through
 * the prena_activity view — there is no second accounting table to drift.
 */

export type ActivityKind = 'entry' | 'reward' | 'claim';
export type ActivityFilter = 'all' | 'entries' | 'rewards' | 'claims';

export interface PrenaActivityItem {
  id: string;
  kind: ActivityKind;
  direction: 'debit' | 'credit';
  amount: string;
  amountFormatted: string;
  tokenSymbol: string;
  status: string;
  txHash: string | null;
  arenaName: string;
  arenaSlug: string;
  projectName: string;
  occurredAt: string;
}

const KIND_FOR_FILTER: Record<Exclude<ActivityFilter, 'all'>, ActivityKind[]> = {
  entries: ['entry'],
  rewards: ['reward'],
  claims: ['claim'],
};

export async function getPrenaActivity(
  builderId: string,
  options: { filter?: ActivityFilter; limit?: number } = {},
): Promise<PrenaActivityItem[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];

  let query = supabase
    .from('prena_activity')
    .select('*, arenas:arena_id(name, slug), projects:project_id(name)')
    .eq('builder_id', builderId)
    .order('occurred_at', { ascending: false })
    .limit(options.limit ?? 100);

  const filter = options.filter ?? 'all';
  if (filter !== 'all') query = query.in('kind', KIND_FOR_FILTER[filter]);

  const { data } = await query;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const arena = (row.arenas ?? {}) as { name?: string; slug?: string };
    const project = (row.projects ?? {}) as { name?: string };
    const amount = String(row.amount ?? '0');
    return {
      id: String(row.id),
      kind: String(row.kind) as ActivityKind,
      direction: String(row.direction) as 'debit' | 'credit',
      amount,
      amountFormatted: formatDisplayAmount(amount),
      tokenSymbol: String(row.token_symbol ?? 'PRENA'),
      status: String(row.status ?? ''),
      txHash: (row.tx_hash as string | null) ?? null,
      arenaName: arena.name ?? 'Arena',
      arenaSlug: arena.slug ?? '',
      projectName: project.name ?? '',
      occurredAt: String(row.occurred_at ?? row.created_at ?? ''),
    };
  });
}
