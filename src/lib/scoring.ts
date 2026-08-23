/**
 * Keep the Arena formula in one module so future formats can swap weights
 * without teaching UI components how a score is produced.
 *
 * Payments never enter this file. Money buys entry, not rank.
 */
import type { ArenaScoringConfig } from './types';

export const DEFAULT_SCORING_CONFIG: ArenaScoringConfig = {
  weights: { supporter: 1, uniqueVisit: 2 },
  rating: {
    champion: 100,
    top10: 70,
    top25: 40,
    top50: 15,
    bottom50: -10,
  },
};

export const ARENA_SCORE_WEIGHTS = DEFAULT_SCORING_CONFIG.weights;

export const STARTING_ARENA_RATING = 1000;

export function calculateArenaScore(
  input: { supporters: number; uniqueVisits: number; config?: ArenaScoringConfig } | number,
  uniqueVisits?: number,
): number {
  if (typeof input === 'number') {
    return input * ARENA_SCORE_WEIGHTS.supporter + (uniqueVisits ?? 0) * ARENA_SCORE_WEIGHTS.uniqueVisit;
  }
  const weights = input.config?.weights ?? ARENA_SCORE_WEIGHTS;
  return input.supporters * weights.supporter + input.uniqueVisits * weights.uniqueVisit;
}

export function parseScoringConfig(value: unknown): ArenaScoringConfig {
  if (!value || typeof value !== 'object') return DEFAULT_SCORING_CONFIG;
  const raw = value as Record<string, unknown>;
  const weights = (raw.weights ?? {}) as Record<string, unknown>;
  const rating = (raw.rating ?? {}) as Record<string, unknown>;
  return {
    weights: {
      supporter: Number(weights.supporter) || DEFAULT_SCORING_CONFIG.weights.supporter,
      uniqueVisit: Number(weights.uniqueVisit) || DEFAULT_SCORING_CONFIG.weights.uniqueVisit,
    },
    rating: {
      champion: Number(rating.champion) || DEFAULT_SCORING_CONFIG.rating.champion,
      top10: Number(rating.top10) || DEFAULT_SCORING_CONFIG.rating.top10,
      top25: Number(rating.top25) || DEFAULT_SCORING_CONFIG.rating.top25,
      top50: Number(rating.top50) || DEFAULT_SCORING_CONFIG.rating.top50,
      bottom50: Number(rating.bottom50) || DEFAULT_SCORING_CONFIG.rating.bottom50,
    },
  };
}

/**
 * Rank-based Arena Rating adjustment. This is not Elo.
 * Champion is exclusive of the remaining percentile buckets.
 */
export function ratingDeltaForRank(
  rank: number,
  field: number,
  config: ArenaScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  if (!rank || !field || field < 1) return 0;
  if (rank === 1) return config.rating.champion;
  const pct = rank / field;
  if (pct <= 0.1) return config.rating.top10;
  if (pct <= 0.25) return config.rating.top25;
  if (pct <= 0.5) return config.rating.top50;
  return config.rating.bottom50;
}

export function percentileLabel(rank: number, field: number): string {
  if (!rank || !field) return '';
  const pct = Math.max(1, Math.round((rank / field) * 100));
  return `Top ${pct}%`;
}

export function visitRate(visits: number, impressions: number): number {
  if (impressions <= 0) return 0;
  return Math.round((visits / impressions) * 1000) / 10;
}
