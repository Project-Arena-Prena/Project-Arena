import {
  ALL_ARENAS,
  DEMO_BUILDER_PROJECT_SLUGS,
  HALL_OF_FAME,
  LIVE_ARENA,
  PAST_ARENAS,
  PROJECTS,
  UPCOMING_ARENAS,
  arenaBySlug,
  historyForProject,
  projectBySlug,
  standingsForArena,
} from './mock-data';
import { createAdminClient, createAnonClient, createClient } from './supabase/server';
import { isSupabaseConfigured } from './supabase/config';
import { reconcileArenas } from './arena-lifecycle';
import {
  PUBLIC_PROJECT_COLUMNS,
  arenaFromRow,
  nested,
  number,
  projectFromRow,
  standingFromRow,
  string,
  type Row,
} from './mappers';
import type {
  Arena,
  ArenaResult,
  ArenaStatus,
  Project,
  ProjectHistoryEntry,
  Standing,
} from './types';
import { UPCOMING_ARENA_STATUSES } from './types';

const ARENA_SELECT = '*, arena_entries(status, unique_visit_count)';

async function readArena(slug?: string): Promise<Arena | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  await reconcileArenas();
  let query = supabase.from('arenas').select(ARENA_SELECT).order('ends_at', { ascending: true }).limit(1);
  query = slug ? query.eq('slug', slug) : query.eq('status', 'live');
  const { data, error } = await query.maybeSingle();
  return error || !data ? null : arenaFromRow(data as Row);
}

export async function getLiveArena(): Promise<Arena | null> {
  const live = await readArena();
  if (live) return live;
  if (isSupabaseConfigured) return null;
  return LIVE_ARENA;
}

export async function getArena(slug: string): Promise<Arena | null> {
  const live = await readArena(slug);
  if (live) return live;
  if (isSupabaseConfigured) return null;
  return arenaBySlug(slug) ?? null;
}

export async function getArenas(): Promise<{
  live: Arena[];
  upcoming: Arena[];
  past: Arena[];
  cancelled: Arena[];
}> {
  const supabase = await createClient();
  if (supabase) {
    await reconcileArenas();
    const { data, error } = await supabase
      .from('arenas')
      .select(ARENA_SELECT)
      .neq('status', 'draft')
      .order('starts_at', { ascending: false });
    const arenas = !error && data ? (data as Row[]).map(arenaFromRow) : [];
    return {
      live: arenas.filter((arena) => arena.status === 'live'),
      upcoming: arenas.filter((arena) => UPCOMING_ARENA_STATUSES.includes(arena.status)).reverse(),
      past: arenas.filter((arena) => arena.status === 'finished'),
      cancelled: arenas.filter((arena) => arena.status === 'cancelled'),
    };
  }
  return { live: [LIVE_ARENA], upcoming: UPCOMING_ARENAS, past: PAST_ARENAS, cancelled: [] };
}

export async function getAllArenaSlugs(): Promise<string[]> {
  const supabase = createAnonClient() ?? (await createClient());
  if (supabase) {
    const { data, error } = await supabase.from('arenas').select('slug').neq('status', 'draft');
    if (!error && data?.length) return data.map((row) => row.slug);
    if (isSupabaseConfigured) return [];
  }
  return ALL_ARENAS.map((arena) => arena.slug);
}

export async function getStandings(slug: string, limit?: number): Promise<Standing[]> {
  const supabase = await createClient();
  if (supabase) {
    let query = supabase.from('arena_standings').select('*').eq('arena_slug', slug).order('rank');
    if (typeof limit === 'number') query = query.limit(limit);
    const { data, error } = await query;
    if (!error && data) {
      const rows = (data as Row[]).map(standingFromRow);
      return attachMomentum(slug, rows);
    }
  }
  const rows = standingsForArena(slug);
  return typeof limit === 'number' ? rows.slice(0, limit) : rows;
}

async function attachMomentum(arenaSlug: string, rows: Standing[]): Promise<Standing[]> {
  if (rows.length === 0) return rows;
  const admin = createAdminClient();
  if (!admin) return rows;
  const { data: arena } = await admin.from('arenas').select('id').eq('slug', arenaSlug).maybeSingle();
  if (!arena) return rows;
  const { data: snaps } = await admin
    .from('rank_snapshots')
    .select('project_id, rank, captured_at')
    .eq('arena_id', arena.id)
    .order('captured_at', { ascending: false })
    .limit(rows.length * 4);
  if (!snaps?.length) return rows;
  const previous = new Map<string, number>();
  for (const snap of snaps as Row[]) {
    const id = string(snap.project_id);
    if (!previous.has(id)) previous.set(id, number(snap.rank));
  }
  return rows.map((row) => {
    const prev = previous.get(row.project.id);
    if (!prev || prev === row.rank) return row;
    return { ...row, previousRank: prev, momentum: prev - row.rank };
  });
}

export async function getProject(slug: string): Promise<Project | null> {
  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('projects')
      .select(PUBLIC_PROJECT_COLUMNS)
      .eq('slug', slug)
      .maybeSingle();
    if (!error && data) return projectFromRow(data as unknown as Row);
  }
  return projectBySlug(slug) ?? null;
}

export async function getAllProjectSlugs(): Promise<string[]> {
  const supabase = createAnonClient() ?? (await createClient());
  if (supabase) {
    const { data, error } = await supabase.from('projects').select('slug').eq('status', 'active');
    if (!error && data?.length) return data.map((row) => row.slug);
    if (isSupabaseConfigured) return [];
  }
  return PROJECTS.map((project) => project.slug);
}

export async function getProjectHistory(slug: string): Promise<ProjectHistoryEntry[]> {
  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('arena_standings')
      .select(
        'arena_id, arena_slug, rank, final_rank, supporter_count, unique_visit_count, impression_count, arenas:arena_id(number,name,ends_at,status,max_entries)',
      )
      .eq('project_slug', slug)
      .eq('arena_status', 'finished');
    if (!error && data) {
      const ids = (data as Row[]).map((row) => string(row.arena_id)).filter(Boolean);
      const ratingByArena = new Map<string, number>();
      if (ids.length) {
        const project = await getProject(slug);
        if (project) {
          const { data: history } = await supabase
            .from('arena_rating_history')
            .select('arena_id, rating_change')
            .eq('project_id', project.id)
            .in('arena_id', ids);
          for (const row of (history ?? []) as Row[]) {
            ratingByArena.set(string(row.arena_id), number(row.rating_change));
          }
        }
      }
      return (data as unknown as Array<Row & { arenas: Row | Row[] }>).map((row) => {
        const arena = nested(row.arenas);
        const rank = number(row.final_rank ?? row.rank);
        return {
          arenaSlug: string(row.arena_slug),
          arenaNumber: number(arena?.number),
          arenaName: string(arena?.name),
          endedAt: string(arena?.ends_at),
          rank,
          entrants: number(arena?.max_entries),
          supporters: number(row.supporter_count),
          clicks: number(row.unique_visit_count),
          impressions: number(row.impression_count),
          ratingDelta: ratingByArena.get(string(row.arena_id)) ?? 0,
          champion: rank === 1,
        };
      });
    }
  }
  return historyForProject(slug);
}

export async function getLiveStandingForProject(slug: string): Promise<Standing | null> {
  const liveArena = await getLiveArena();
  if (!liveArena) return null;
  return (await getStandings(liveArena.slug)).find((standing) => standing.project.slug === slug) ?? null;
}

export async function getHallOfFame(): Promise<ArenaResult[]> {
  const supabase = await createClient();
  if (supabase) {
    await reconcileArenas();
    const { data, error } = await supabase
      .from('arenas')
      .select(ARENA_SELECT)
      .eq('status', 'finished')
      .order('ends_at', { ascending: false });
    if (!error && data) {
      const results: ArenaResult[] = [];
      for (const row of data as Row[]) {
        const arena = arenaFromRow(row);
        const standings = await getStandings(arena.slug);
        const champion = standings[0];
        if (!champion) continue;
        results.push({ arena, champion, runnersUp: standings.slice(1, 3) });
      }
      return results;
    }
    if (isSupabaseConfigured) return [];
  }
  return HALL_OF_FAME;
}

export async function getTopRatedProjects(limit = 10): Promise<Project[]> {
  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('projects')
      .select(PUBLIC_PROJECT_COLUMNS)
      .eq('status', 'active')
      .order('arena_rating', { ascending: false })
      .limit(limit);
    if (!error && data) return (data as unknown as Row[]).map((row) => projectFromRow(row));
    if (isSupabaseConfigured) return [];
  }
  return [...PROJECTS].sort((a, b) => b.arenaRating - a.arenaRating).slice(0, limit);
}

export async function getBuilderProjects(): Promise<Project[]> {
  return PROJECTS.filter((project) => DEMO_BUILDER_PROJECT_SLUGS.includes(project.slug));
}

export async function getNextArenaForCategory(category: string, excludeSlug?: string): Promise<Arena | null> {
  const { upcoming } = await getArenas();
  const open = upcoming.filter((arena) => arena.status === 'registration' && arena.slug !== excludeSlug);
  return (
    open.find((arena) => arena.category.toLowerCase() === category.toLowerCase()) ?? open[0] ?? null
  );
}

export function isPublicStatus(status: ArenaStatus): boolean {
  return status !== 'draft';
}
