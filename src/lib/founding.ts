import type { Arena } from './types';

export type FoundingPhase = 'draft' | 'open' | 'entry_closed' | 'live' | 'finalizing' | 'completed' | 'cancelled';
export const PHASE_LABEL: Record<FoundingPhase, string> = {
  draft: 'Being prepared', open: 'Entry open', entry_closed: 'Entry closed',
  live: 'Live', finalizing: 'Results being verified', completed: 'Complete', cancelled: 'Cancelled',
};
export function foundingPhase(arena: Arena | null, now: number): FoundingPhase {
  if (!arena || arena.lifecyclePhase === 'draft' || (!arena.lifecyclePhase && arena.status === 'draft')) return 'draft';
  if (arena.lifecyclePhase === 'cancelled' || (!arena.lifecyclePhase && arena.status === 'cancelled')) return 'cancelled';
  if (arena.lifecyclePhase === 'completed' || (!arena.lifecyclePhase && arena.status === 'finished')) return 'completed';
  if (arena.lifecyclePhase === 'finalizing') return 'finalizing';
  // Time can close eligibility, but never invent a server transition to live or complete.
  if (arena.lifecyclePhase === 'live' || (!arena.lifecyclePhase && arena.status === 'live')) return now >= Date.parse(arena.endsAt) ? 'finalizing' : 'live';
  if (arena.registrationOpensAt && now < Date.parse(arena.registrationOpensAt)) return 'draft';
  if (arena.lifecyclePhase === 'entry_closed' || arena.status === 'full' ||
    arena.entrantCount >= arena.entrantCap || now >= Date.parse(arena.startsAt) ||
    (arena.registrationClosesAt && now >= Date.parse(arena.registrationClosesAt))) return 'entry_closed';
  return 'open';
}
export function foundingAction(phase: FoundingPhase) {
  if (phase === 'open') return { href: '/enter?arena=founding', label: 'Enter your Project' };
  if (phase === 'live') return { href: '/rankings', label: 'Explore the live board' };
  if (phase === 'completed') return { href: '/rankings', label: 'View the final record' };
  return { href: '/arena/founding', label: 'Explore the Founding Arena' };
}
