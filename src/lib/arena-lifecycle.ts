import { createAdminClient } from './supabase/server';
import { flushEmailOutbox } from './notifications';

let lastReconcile = 0;
const RECONCILE_TTL_MS = 15_000;

/**
 * Server-side Arena state machine. Called from reads that need current status
 * and from the cron route. Safe to invoke concurrently — the SQL functions
 * lock arena rows.
 */
export async function reconcileArenas(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastReconcile < RECONCILE_TTL_MS) return;
  lastReconcile = now;

  const supabase = createAdminClient();
  if (!supabase) return;

  // The Founding Arena wrapper keeps the legacy UI status compatible while
  // recording the stricter lifecycle phases and freezing immutable results.
  const { error } = await supabase.rpc('reconcile_founding_arenas');
  // A database that has not received the additive migration can still serve
  // the existing commercial loop while an operator completes the rollout.
  if (error?.code === 'PGRST202' || error?.message.includes('reconcile_founding_arenas')) {
    await supabase.rpc('reconcile_arenas');
  }
  await flushEmailOutbox().catch(() => undefined);
}

export function arenaAcceptsEntries(status: string, startsAt?: string, closesAt?: string | null): boolean {
  if (status !== 'registration') return false;
  const now = Date.now();
  if (startsAt && Date.parse(startsAt) <= now) return false;
  if (closesAt && Date.parse(closesAt) <= now) return false;
  return true;
}
