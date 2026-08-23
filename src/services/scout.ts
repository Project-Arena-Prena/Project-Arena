import { createAdminClient } from '@/lib/supabase/server';

/**
 * Scout Points — foundation only (Phase 3 §16).
 *
 * Scout Points are a non-transferable, non-monetary reputation balance. They are
 * earned and spent only inside Project Arena: there is no conversion to $PRENA,
 * no builder-to-builder transfer, and no cash value. This module deliberately
 * exposes no such function, and the database has no column that could hold one.
 *
 * No prediction feature is live. `listScoutPredictions` reads a table nothing
 * writes to yet — there is intentionally no `createScoutPrediction` here, so a
 * prediction cannot be made until the feature is actually designed. When it is,
 * it commits Scout Points and nothing else. No wager, no stake, no payout.
 *
 * Like `rewards.ts`, nothing here writes to a scoring column. Scout activity can
 * never move a Project's score, rank, or Arena Rating.
 */

export type ScoutReason =
  | 'arena_participation'
  | 'discovery'
  | 'prediction_accuracy'
  | 'seasonal'
  | 'admin_adjustment';

export type ScoutPredictionOutcome = 'pending' | 'correct' | 'incorrect' | 'void';

export type ScoutPredictionBucket =
  | 'champion'
  | 'top_3'
  | 'top_10'
  | 'top_25_percent'
  | 'top_50_percent';

export interface ScoutBalance {
  builderId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string | null;
}

export interface ScoutPointEvent {
  id: string;
  builderId: string;
  arenaId: string | null;
  arenaName: string | null;
  projectId: string | null;
  projectName: string | null;
  predictionId: string | null;
  /** Signed: positive is an award, negative is a spend. Never zero. */
  delta: number;
  reason: ScoutReason;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}

export interface ScoutPrediction {
  id: string;
  builderId: string;
  arenaId: string;
  arenaName: string;
  arenaSlug: string;
  projectId: string;
  projectName: string;
  predictedRank: number | null;
  predictedBucket: ScoutPredictionBucket | null;
  /** Scout Points spent to make the call. Not a stake — nothing is returned. */
  pointsCommitted: number;
  outcome: ScoutPredictionOutcome;
  actualRank: number | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ScoutSummary {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  events: number;
  predictions: number;
  predictionsCorrect: number;
}

const EMPTY_SUMMARY: ScoutSummary = {
  balance: 0,
  lifetimeEarned: 0,
  lifetimeSpent: 0,
  events: 0,
  predictions: 0,
  predictionsCorrect: 0,
};

export async function getScoutBalance(builderId: string): Promise<ScoutBalance> {
  const empty: ScoutBalance = {
    builderId,
    balance: 0,
    lifetimeEarned: 0,
    lifetimeSpent: 0,
    updatedAt: null,
  };
  const supabase = createAdminClient();
  if (!supabase) return empty;
  const { data } = await supabase
    .from('scout_points')
    .select('*')
    .eq('builder_id', builderId)
    .maybeSingle();
  // A Builder who has never earned a point has no row, which reads as zero.
  if (!data) return empty;
  const row = data as Record<string, unknown>;
  return {
    builderId,
    balance: Number(row.balance ?? 0),
    lifetimeEarned: Number(row.lifetime_earned ?? 0),
    lifetimeSpent: Number(row.lifetime_spent ?? 0),
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}

export async function getBuilderScoutSummary(builderId: string): Promise<ScoutSummary> {
  const supabase = createAdminClient();
  if (!supabase) return EMPTY_SUMMARY;
  const { data } = await supabase.rpc('builder_scout_summary', { p_builder_id: builderId });
  const payload = (data ?? {}) as Partial<Record<keyof ScoutSummary, number>>;
  return {
    balance: Number(payload.balance ?? 0),
    lifetimeEarned: Number(payload.lifetimeEarned ?? 0),
    lifetimeSpent: Number(payload.lifetimeSpent ?? 0),
    events: Number(payload.events ?? 0),
    predictions: Number(payload.predictions ?? 0),
    predictionsCorrect: Number(payload.predictionsCorrect ?? 0),
  };
}

export async function listScoutPointEvents(
  builderId: string,
  options: { reasons?: ScoutReason[]; limit?: number } = {},
): Promise<ScoutPointEvent[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  let query = supabase
    .from('scout_point_events')
    .select('*, arenas:arena_id(name), projects:project_id(name)')
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 100);
  if (options.reasons?.length) query = query.in('reason', options.reasons);
  const { data } = await query;
  return ((data ?? []) as Array<Record<string, unknown>>).map(toEvent);
}

export type AwardScoutPointsResult =
  | { ok: true; eventId: string; balance: number; delta: number }
  | { ok: false; error: string };

/**
 * The only way points move. Routed through `award_scout_points` so the balance
 * update and its audit row are one atomic act under a row lock — the database,
 * not the caller, decides whether a Builder can afford a deduction.
 *
 * Pass a negative `delta` to spend. There is no counterpart that credits another
 * Builder, which is what keeps points non-transferable.
 */
export async function awardScoutPoints(input: {
  builderId: string;
  delta: number;
  reason: ScoutReason;
  arenaId?: string | null;
  projectId?: string | null;
  note?: string | null;
}): Promise<AwardScoutPointsResult> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const { data, error } = await supabase.rpc('award_scout_points', {
    p_builder_id: input.builderId,
    p_delta: input.delta,
    p_reason: input.reason,
    p_arena_id: input.arenaId ?? null,
    p_project_id: input.projectId ?? null,
    p_note: input.note ?? null,
  });

  if (error) {
    const known = ['zero_delta', 'builder_not_found', 'insufficient_scout_points'];
    return { ok: false, error: known.find((code) => (error.message ?? '').includes(code)) ?? 'award_failed' };
  }

  const payload = data as { event_id: string; balance: number; delta: number };
  return {
    ok: true,
    eventId: String(payload.event_id),
    balance: Number(payload.balance ?? 0),
    delta: Number(payload.delta ?? input.delta),
  };
}

export async function listScoutPredictions(
  builderId: string,
  options: { arenaId?: string; outcomes?: ScoutPredictionOutcome[]; limit?: number } = {},
): Promise<ScoutPrediction[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  let query = supabase
    .from('scout_predictions')
    .select('*, arenas:arena_id(name, slug), projects:project_id(name)')
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 100);
  if (options.arenaId) query = query.eq('arena_id', options.arenaId);
  if (options.outcomes?.length) query = query.in('outcome', options.outcomes);
  const { data } = await query;
  return ((data ?? []) as Array<Record<string, unknown>>).map(toPrediction);
}

/** Every call made on one Arena — what a future resolution job would read. */
export async function listArenaScoutPredictions(arenaId: string): Promise<ScoutPrediction[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('scout_predictions')
    .select('*, arenas:arena_id(name, slug), projects:project_id(name)')
    .eq('arena_id', arenaId)
    .order('created_at', { ascending: true });
  return ((data ?? []) as Array<Record<string, unknown>>).map(toPrediction);
}

function toEvent(row: Record<string, unknown>): ScoutPointEvent {
  const arena = (row.arenas ?? {}) as { name?: string };
  const project = (row.projects ?? {}) as { name?: string };
  return {
    id: String(row.id),
    builderId: String(row.builder_id),
    arenaId: (row.arena_id as string | null) ?? null,
    arenaName: arena.name ?? null,
    projectId: (row.project_id as string | null) ?? null,
    projectName: project.name ?? null,
    predictionId: (row.prediction_id as string | null) ?? null,
    delta: Number(row.delta ?? 0),
    reason: String(row.reason) as ScoutReason,
    balanceAfter: Number(row.balance_after ?? 0),
    note: (row.note as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
  };
}

function toPrediction(row: Record<string, unknown>): ScoutPrediction {
  const arena = (row.arenas ?? {}) as { name?: string; slug?: string };
  const project = (row.projects ?? {}) as { name?: string };
  return {
    id: String(row.id),
    builderId: String(row.builder_id),
    arenaId: String(row.arena_id),
    arenaName: arena.name ?? 'Arena',
    arenaSlug: arena.slug ?? '',
    projectId: String(row.project_id),
    projectName: project.name ?? 'Project',
    predictedRank: row.predicted_rank == null ? null : Number(row.predicted_rank),
    predictedBucket: (row.predicted_bucket as ScoutPredictionBucket | null) ?? null,
    pointsCommitted: Number(row.points_committed ?? 0),
    outcome: String(row.outcome ?? 'pending') as ScoutPredictionOutcome,
    actualRank: row.actual_rank == null ? null : Number(row.actual_rank),
    createdAt: String(row.created_at ?? ''),
    resolvedAt: (row.resolved_at as string | null) ?? null,
  };
}
