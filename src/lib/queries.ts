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
import { createClient } from './supabase/server';
import type { Arena, ArenaResult, Project, ProjectCategory, ProjectHistoryEntry, Standing } from './types';

type Row = Record<string, unknown>;

const PUBLIC_PROJECT_COLUMNS = [
  'id', 'name', 'slug', 'tagline', 'description', 'logo_url', 'website_url', 'x_url',
  'github_url', 'category', 'arena_rating', 'total_supporters', 'total_project_visits',
  'arena_appearances', 'championships', 'highest_rank', 'created_at',
].join(',');

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : Number(value) || fallback;
}

function string(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function projectFromRow(row: Row): Project {
  const slug = string(row.slug ?? row.project_slug);
  const name = string(row.name ?? row.project_name);
  return {
    id: string(row.id ?? row.project_id),
    slug,
    name,
    tagline: string(row.tagline),
    description: string(row.description, `${name} is competing for attention on Project Arena.`),
    url: string(row.website_url),
    category: string(row.category, 'Other') as ProjectCategory,
    logoUrl: typeof row.logo_url === 'string' ? row.logo_url : null,
    xUrl: typeof row.x_url === 'string' ? row.x_url : null,
    githubUrl: typeof row.github_url === 'string' ? row.github_url : null,
    builder: { id: `builder-${slug}`, handle: slug, displayName: 'Project Builder', avatarUrl: null },
    arenaRating: number(row.arena_rating, 1200),
    appearances: number(row.arena_appearances),
    wins: number(row.championships),
    podiums: 0,
    totalSupporters: number(row.total_supporters),
    totalClicks: number(row.total_project_visits),
    createdAt: string(row.created_at, new Date(0).toISOString()),
  };
}

function arenaFromRow(row: Row): Arena {
  const entries = Array.isArray(row.arena_entries) ? (row.arena_entries as Row[]) : [];
  const confirmed = entries.filter((entry) => entry.status === 'confirmed');
  return {
    id: string(row.id),
    slug: string(row.slug),
    number: number(row.number),
    name: string(row.name),
    theme: string(row.description),
    status: string(row.status, 'upcoming') as Arena['status'],
    startsAt: string(row.starts_at),
    endsAt: string(row.ends_at),
    entryFeeCents: number(row.entry_price),
    entrantCap: number(row.max_entries, 32),
    entrantCount: confirmed.length,
    spectators: number(row.spectators),
    visits: confirmed.reduce((sum, entry) => sum + number(entry.unique_visit_count), 0),
    prize: 'Champion badge, permanent Hall of Fame entry, and featured placement',
  };
}

async function readArena(slug?: string): Promise<Arena | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  let query = supabase
    .from('arenas')
    .select('*, arena_entries(status, unique_visit_count)')
    .order('ends_at', { ascending: true })
    .limit(1);
  query = slug ? query.eq('slug', slug) : query.eq('status', 'live');
  const { data, error } = await query.maybeSingle();
  return error || !data ? null : arenaFromRow(data as Row);
}

export async function getLiveArena(): Promise<Arena | null> {
  return (await readArena()) ?? LIVE_ARENA;
}

export async function getArena(slug: string): Promise<Arena | null> {
  return (await readArena(slug)) ?? arenaBySlug(slug) ?? null;
}

export async function getArenas(): Promise<{ live: Arena[]; upcoming: Arena[]; past: Arena[] }> {
  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('arenas')
      .select('*, arena_entries(status, unique_visit_count)')
      .order('starts_at', { ascending: false });
    if (!error && data) {
      const arenas = (data as Row[]).map(arenaFromRow);
      return {
        live: arenas.filter((arena) => arena.status === 'live'),
        upcoming: arenas.filter((arena) => arena.status === 'upcoming').reverse(),
        past: arenas.filter((arena) => arena.status === 'finished'),
      };
    }
  }
  return { live: [LIVE_ARENA], upcoming: UPCOMING_ARENAS, past: PAST_ARENAS };
}

export async function getAllArenaSlugs(): Promise<string[]> {
  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase.from('arenas').select('slug');
    if (!error && data?.length) return data.map((row) => row.slug);
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
      return (data as Row[]).map((row) => ({
        rank: number(row.rank),
        previousRank: null,
        project: projectFromRow(row),
        supporters: number(row.supporter_count),
        clicks: number(row.unique_visit_count),
        score: number(row.score),
        share: number(row.score_share),
        momentum: 0,
      }));
    }
  }
  const rows = standingsForArena(slug);
  return typeof limit === 'number' ? rows.slice(0, limit) : rows;
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
  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase.from('projects').select('slug');
    if (!error && data?.length) return data.map((row) => row.slug);
  }
  return PROJECTS.map((project) => project.slug);
}

export async function getProjectHistory(slug: string): Promise<ProjectHistoryEntry[]> {
  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('arena_standings')
      .select('arena_slug, rank, supporter_count, unique_visit_count, arenas:arena_id(number,name,ends_at,status,max_entries)')
      .eq('project_slug', slug)
      .eq('arena_status', 'finished');
    if (!error && data) {
      return (data as unknown as Array<Row & { arenas: Row | Row[] }>).map((row) => {
        const arena = Array.isArray(row.arenas) ? row.arenas[0] : row.arenas;
        return {
          arenaSlug: string(row.arena_slug),
          arenaNumber: number(arena?.number),
          arenaName: string(arena?.name),
          endedAt: string(arena?.ends_at),
          rank: number(row.rank),
          entrants: number(arena?.max_entries),
          supporters: number(row.supporter_count),
          clicks: number(row.unique_visit_count),
          ratingDelta: number(row.rank) === 1 ? 32 : number(row.rank) <= 3 ? 20 : 8,
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
  return HALL_OF_FAME;
}

export async function getTopRatedProjects(limit = 10): Promise<Project[]> {
  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('projects')
      .select(PUBLIC_PROJECT_COLUMNS)
      .order('arena_rating', { ascending: false })
      .limit(limit);
    if (!error && data) return (data as unknown as Row[]).map(projectFromRow);
  }
  return [...PROJECTS].sort((a, b) => b.arenaRating - a.arenaRating).slice(0, limit);
}

export async function getBuilderProjects(): Promise<Project[]> {
  return PROJECTS.filter((project) => DEMO_BUILDER_PROJECT_SLUGS.includes(project.slug));
}
