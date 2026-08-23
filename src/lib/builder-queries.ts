import { createAdminClient } from './supabase/server';
import { fromBaseUnits, tryParseBaseUnits } from './prena/amount';
import { getArenas, getLiveArena, getStandings } from './queries';
import { visitRate } from './scoring';
import {
  arenaFromRow,
  builderFromRow,
  entryFromRow,
  nested,
  number,
  optionalString,
  paymentFromRow,
  projectFromRow,
  string,
  type Row,
} from './mappers';
import type {
  Arena,
  ArenaEntry,
  Builder,
  Payment,
  Project,
  ProjectArenaStats,
  RankSnapshot,
  Standing,
} from './types';

export interface OwnedProject {
  project: Project;
  role: string;
}

export interface BuilderEntryCard {
  entry: ArenaEntry;
  arena: Arena;
  project: Project;
  payment: Payment | null;
}

export async function getOwnedProjects(builderId: string): Promise<OwnedProject[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from('project_owners')
    .select('role, projects:project_id(*)')
    .eq('builder_id', builderId);
  if (error || !data) return [];
  return (data as Array<Row & { projects: Row | Row[] }>).flatMap((row) => {
    const projectRow = nested(row.projects);
    if (!projectRow) return [];
    return [{ project: projectFromRow(projectRow), role: string(row.role, 'owner') }];
  });
}

export async function getOwnedProject(builderId: string, projectId: string): Promise<Project | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from('project_owners')
    .select('projects:project_id(*)')
    .eq('builder_id', builderId)
    .eq('project_id', projectId)
    .maybeSingle();
  const projectRow = nested((data as Row | null)?.projects);
  return projectRow ? projectFromRow(projectRow) : null;
}

export async function getBuilderEntries(builderId: string): Promise<BuilderEntryCard[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from('arena_entries')
    .select('*, arenas:arena_id(*), projects:project_id(*), payments:payment_id(*)')
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false });
  return ((data ?? []) as Array<Row & { arenas: Row; projects: Row; payments: Row | null }>).flatMap((row) => {
    const arenaRow = nested(row.arenas);
    const projectRow = nested(row.projects);
    if (!arenaRow || !projectRow) return [];
    const paymentRow = nested(row.payments);
    return [
      {
        entry: entryFromRow(row),
        arena: arenaFromRow({ ...arenaRow, arena_entries: [] }),
        project: projectFromRow(projectRow),
        payment: paymentRow ? paymentFromRow(paymentRow) : null,
      },
    ];
  });
}


export async function getProjectArenaStats(
  projectId: string,
  arenaId: string,
): Promise<{ arena: Arena; project: Project; entry: ArenaEntry; stats: ProjectArenaStats } | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: entryRow } = await admin
    .from('arena_entries')
    .select('*, arenas:arena_id(*), projects:project_id(*)')
    .eq('project_id', projectId)
    .eq('arena_id', arenaId)
    .maybeSingle();
  if (!entryRow) return null;
  const arenaRow = nested((entryRow as Row).arenas);
  const projectRow = nested((entryRow as Row).projects);
  if (!arenaRow || !projectRow) return null;
  const arena = arenaFromRow({ ...arenaRow, arena_entries: [] });
  const project = projectFromRow(projectRow);
  const entry = entryFromRow(entryRow as Row);

  const [{ data: snaps }, { data: rating }, { data: visits }] = await Promise.all([
    admin
      .from('rank_snapshots')
      .select('rank, score, label, captured_at')
      .eq('arena_id', arenaId)
      .eq('project_id', projectId)
      .order('captured_at', { ascending: true }),
    admin
      .from('arena_rating_history')
      .select('rating_change')
      .eq('arena_id', arenaId)
      .eq('project_id', projectId)
      .maybeSingle(),
    admin
      .from('outbound_visits')
      .select('created_at')
      .eq('arena_id', arenaId)
      .eq('project_id', projectId)
      .eq('is_valid', true)
      .order('created_at', { ascending: true }),
  ]);

  const field = Math.max(entry.finalRank ?? entry.currentRank ?? 1, arena.entrantCount);
  const rank = entry.finalRank ?? entry.currentRank;
  const rankHistory: RankSnapshot[] = ((snaps ?? []) as Row[]).map((row) => ({
    rank: number(row.rank),
    score: number(row.score),
    label: string(row.label),
    capturedAt: string(row.captured_at),
  }));

  const durationMs = Math.max(1, Date.parse(arena.endsAt) - Date.parse(arena.startsAt));
  const hourly = durationMs <= 1000 * 60 * 60 * 48;
  const buckets = new Map<string, number>();
  for (const row of (visits ?? []) as Row[]) {
    const t = new Date(string(row.created_at));
    const key = hourly
      ? `${t.getUTCFullYear()}-${t.getUTCMonth()}-${t.getUTCDate()}-${t.getUTCHours()}`
      : t.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const visitsOverTime = [...buckets.entries()].map(([t, count]) => ({ t, visits: count }));

  return {
    arena,
    project,
    entry,
    stats: {
      impressions: entry.impressionCount,
      visits: entry.uniqueVisitCount,
      supporters: entry.supporterCount,
      score: entry.score,
      rank,
      field,
      visitRate: visitRate(entry.uniqueVisitCount, entry.impressionCount),
      ratingChange: rating ? number((rating as Row).rating_change) : null,
      rankHistory,
      visitsOverTime,
    },
  };
}

export async function getBuilderDashboard(builderId: string): Promise<{
  projects: Project[];
  live: Array<{ project: Project; arena: Arena; standing: Standing; movement: number }>;
  upcoming: Arena[];
  entries: BuilderEntryCard[];
}> {
  const owned = await getOwnedProjects(builderId);
  const projects = owned.map((item) => item.project);
  const [liveArena, { upcoming }, entries] = await Promise.all([
    getLiveArena(),
    getArenas(),
    getBuilderEntries(builderId),
  ]);

  const live: Array<{ project: Project; arena: Arena; standing: Standing; movement: number }> = [];
  if (liveArena) {
    const standings = await getStandings(liveArena.slug);
    for (const project of projects) {
      const standing = standings.find((row) => row.project.id === project.id || row.project.slug === project.slug);
      if (standing) {
        live.push({
          project,
          arena: liveArena,
          standing,
          movement: standing.momentum,
        });
      }
    }
  }

  return { projects, live, upcoming, entries };
}

export async function getLatestRatingDelta(projectId: string): Promise<number | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from('arena_rating_history')
    .select('rating_change')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? number((data as Row).rating_change) : null;
}

export function builderFromId(builder: Builder): Builder {
  return builderFromRow({
    id: builder.id,
    user_id: builder.userId,
    display_name: builder.displayName,
    email: builder.email,
    avatar_url: builder.avatarUrl,
  });
}

export interface BuilderEntryPayment {
  id: string;
  /** Which rail settled this entry. */
  rail: 'card' | 'prena';
  arenaName: string;
  projectName: string;
  status: string;
  /** Card entries carry USD cents; $PRENA entries carry a token amount. */
  amountCents: number | null;
  tokenAmountDisplay: string | null;
  tokenSymbol: string | null;
  receiptUrl: string | null;
  txHash: string | null;
  createdAt: string;
}

/**
 * Every entry payment a Builder has made, on either rail. Billing read the
 * `payments` table alone, so a Builder who paid in $PRENA was told they had no
 * payment history at all.
 */
export async function getBuilderEntryPayments(builderId: string): Promise<BuilderEntryPayment[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const [{ data: cards }, { data: tokens }] = await Promise.all([
    admin
      .from('payments')
      .select('*, arenas:arena_id(name), projects:project_id(name)')
      .eq('builder_id', builderId)
      .order('created_at', { ascending: false }),
    admin
      .from('token_payments')
      .select('*, arenas:arena_id(name), projects:project_id(name)')
      .eq('builder_id', builderId)
      .order('created_at', { ascending: false }),
  ]);

  const cardRows: BuilderEntryPayment[] = ((cards ?? []) as Row[]).map((row) => ({
    id: string(row.id),
    rail: 'card',
    arenaName: string(nested(row.arenas)?.name),
    projectName: string(nested(row.projects)?.name),
    status: string(row.status),
    amountCents: number(row.amount),
    tokenAmountDisplay: null,
    tokenSymbol: null,
    receiptUrl: optionalString(row.receipt_url),
    txHash: null,
    createdAt: string(row.created_at),
  }));

  const tokenRows: BuilderEntryPayment[] = ((tokens ?? []) as Row[]).map((row) => ({
    id: string(row.id),
    rail: 'prena',
    arenaName: string(nested(row.arenas)?.name),
    projectName: string(nested(row.projects)?.name),
    status: string(row.status),
    amountCents: null,
    tokenAmountDisplay: fromBaseUnits(tryParseBaseUnits(row.token_amount) ?? 0n, number(row.token_decimals, 18)),
    tokenSymbol: string(row.token_symbol, 'PRENA'),
    receiptUrl: null,
    txHash: optionalString(row.tx_hash),
    createdAt: string(row.created_at),
  }));

  return [...cardRows, ...tokenRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
