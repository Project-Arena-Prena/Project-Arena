/**
 * In-process Arena clock. Mirrors the SQL state machine so a dry-run can
 * prove start → score → freeze → Champion → rating without a database.
 * Payments never appear here.
 */
import {
  DEFAULT_SCORING_CONFIG,
  STARTING_ARENA_RATING,
  calculateArenaScore,
  ratingDeltaForRank,
} from './scoring';
import type { ArenaScoringConfig, ArenaStatus } from './types';

export interface ClockArena {
  status: ArenaStatus;
  registrationOpensAt: number;
  startsAt: number;
  endsAt: number;
  maxEntries: number;
  occupied: number;
}

export interface ClockEntry {
  project: string;
  rating: number;
  supporters: number;
  uniqueVisits: number;
  joinedAt: number;
}

export interface ClockResult {
  project: string;
  rank: number;
  score: number;
  supporters: number;
  uniqueVisits: number;
  ratingBefore: number;
  ratingChange: number;
  ratingAfter: number;
  champion: boolean;
}

export function tickArena(arena: ClockArena, now: number): ClockArena {
  const next = { ...arena };
  if (next.status === 'cancelled' || next.status === 'finished') return next;

  if (next.status === 'draft' && now >= next.registrationOpensAt && now < next.startsAt) {
    next.status = 'registration';
  }

  if (next.status === 'registration' && next.occupied >= next.maxEntries) {
    next.status = 'full';
  } else if (next.status === 'full' && next.occupied < next.maxEntries && now < next.startsAt) {
    next.status = 'registration';
  }

  if ((next.status === 'registration' || next.status === 'full') && now >= next.startsAt && now < next.endsAt) {
    next.status = 'live';
  }

  if (next.status === 'live' && now >= next.endsAt) {
    next.status = 'finished';
  }

  return next;
}

export function freezeField(
  entries: ClockEntry[],
  config: ArenaScoringConfig = DEFAULT_SCORING_CONFIG,
): ClockResult[] {
  const ranked = [...entries]
    .map((entry) => ({
      ...entry,
      score: calculateArenaScore({
        supporters: entry.supporters,
        uniqueVisits: entry.uniqueVisits,
        config,
      }),
    }))
    .sort((a, b) => b.score - a.score || b.supporters - a.supporters || a.joinedAt - b.joinedAt);

  const field = ranked.length;
  return ranked.map((entry, index) => {
    const rank = index + 1;
    const ratingChange = ratingDeltaForRank(rank, field, config);
    return {
      project: entry.project,
      rank,
      score: entry.score,
      supporters: entry.supporters,
      uniqueVisits: entry.uniqueVisits,
      ratingBefore: entry.rating,
      ratingChange,
      ratingAfter: Math.max(0, entry.rating + ratingChange),
      champion: rank === 1,
    };
  });
}

export function runClock(opts?: { now?: number }): {
  phases: ArenaStatus[];
  results: ClockResult[];
  champion: ClockResult;
} {
  const t0 = opts?.now ?? Date.UTC(2026, 7, 22, 12, 0, 0);
  const hour = 3_600_000;
  let arena: ClockArena = {
    status: 'draft',
    registrationOpensAt: t0,
    startsAt: t0 + 24 * hour,
    endsAt: t0 + 48 * hour,
    maxEntries: 8,
    occupied: 0,
  };

  const phases: ArenaStatus[] = [arena.status];
  const observe = (now: number, occupied = arena.occupied) => {
    arena = tickArena({ ...arena, occupied }, now);
    if (phases[phases.length - 1] !== arena.status) phases.push(arena.status);
  };

  observe(t0 + 1_000);
  arena.occupied = 3;
  observe(t0 + 2 * hour, 3);
  observe(t0 + 24 * hour + 1_000, 3);
  observe(t0 + 48 * hour + 1_000, 3);

  const results = freezeField([
    { project: 'Kinetix', rating: STARTING_ARENA_RATING, supporters: 3104, uniqueVisits: 1842, joinedAt: 1 },
    { project: 'TinyTools', rating: STARTING_ARENA_RATING, supporters: 2201, uniqueVisits: 1410, joinedAt: 2 },
    { project: 'Relaykit', rating: STARTING_ARENA_RATING, supporters: 980, uniqueVisits: 640, joinedAt: 3 },
  ]);

  const champion = results[0];
  if (!champion) throw new Error('clock produced no Champion');
  return { phases, results, champion };
}

export function assertClock(run = runClock()): void {
  const expected: ArenaStatus[] = ['draft', 'registration', 'live', 'finished'];
  if (run.phases.join('>') !== expected.join('>')) {
    throw new Error(`clock phases ${run.phases.join('>')} !== ${expected.join('>')}`);
  }
  if (run.champion.project !== 'Kinetix') throw new Error('expected Kinetix Champion');
  if (run.champion.rank !== 1) throw new Error('Champion rank is not 1');
  if (run.champion.ratingChange !== 100) throw new Error('Champion rating is not +100');
  if (run.results.some((row, i) => i > 0 && row.score > run.champion.score)) {
    throw new Error('a non-champion outscored the Champion after freeze');
  }
  const frozen = freezeField(
    run.results.map((row) => ({
      project: row.project,
      rating: row.ratingAfter,
      supporters: row.supporters,
      uniqueVisits: row.uniqueVisits,
      joinedAt: 0,
    })),
  );
  if (frozen.map((row) => row.rank).join() !== run.results.map((row) => row.rank).join()) {
    throw new Error('final ranking moved after freeze');
  }
}
