/**
 * Keep the Arena formula in one module so future formats can swap weights
 * without teaching UI components how a score is produced.
 */
export const ARENA_SCORE_WEIGHTS = {
  supporter: 1,
  uniqueVisit: 2,
} as const;

export function calculateArenaScore(supporters: number, uniqueVisits: number): number {
  return supporters * ARENA_SCORE_WEIGHTS.supporter + uniqueVisits * ARENA_SCORE_WEIGHTS.uniqueVisit;
}
