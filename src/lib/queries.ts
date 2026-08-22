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
import type { Arena, ArenaResult, Project, ProjectHistoryEntry, Standing } from './types';

/**
 * Single read surface for pages. Backed by fixtures today; swap each function
 * body for a Supabase query without touching any component.
 */

export async function getLiveArena(): Promise<Arena | null> {
  return LIVE_ARENA;
}

export async function getArena(slug: string): Promise<Arena | null> {
  return arenaBySlug(slug) ?? null;
}

export async function getArenas(): Promise<{ live: Arena[]; upcoming: Arena[]; past: Arena[] }> {
  return { live: [LIVE_ARENA], upcoming: UPCOMING_ARENAS, past: PAST_ARENAS };
}

export async function getAllArenaSlugs(): Promise<string[]> {
  return ALL_ARENAS.map((a) => a.slug);
}

export async function getStandings(slug: string, limit?: number): Promise<Standing[]> {
  const rows = standingsForArena(slug);
  return typeof limit === 'number' ? rows.slice(0, limit) : rows;
}

export async function getProject(slug: string): Promise<Project | null> {
  return projectBySlug(slug) ?? null;
}

export async function getAllProjectSlugs(): Promise<string[]> {
  return PROJECTS.map((p) => p.slug);
}

export async function getProjectHistory(slug: string): Promise<ProjectHistoryEntry[]> {
  return historyForProject(slug);
}

/** Rank of a project within the current live Arena, if it is competing. */
export async function getLiveStandingForProject(slug: string): Promise<Standing | null> {
  return standingsForArena(LIVE_ARENA.slug).find((s) => s.project.slug === slug) ?? null;
}

export async function getHallOfFame(): Promise<ArenaResult[]> {
  return HALL_OF_FAME;
}

export async function getTopRatedProjects(limit = 10): Promise<Project[]> {
  return [...PROJECTS].sort((a, b) => b.arenaRating - a.arenaRating).slice(0, limit);
}

export async function getBuilderProjects(): Promise<Project[]> {
  return PROJECTS.filter((p) => DEMO_BUILDER_PROJECT_SLUGS.includes(p.slug));
}
