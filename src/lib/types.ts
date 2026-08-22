export type ArenaStatus = 'upcoming' | 'live' | 'ended';

export type ProjectCategory =
  | 'AI'
  | 'SaaS'
  | 'Game'
  | 'Mobile'
  | 'Open Source'
  | 'Dev Tool'
  | 'Design'
  | 'Web3'
  | 'Creator'
  | 'Community'
  | 'Experiment';

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  'AI',
  'SaaS',
  'Game',
  'Mobile',
  'Open Source',
  'Dev Tool',
  'Design',
  'Web3',
  'Creator',
  'Community',
  'Experiment',
];

export interface Builder {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  category: ProjectCategory;
  logoUrl: string | null;
  builder: Builder;
  arenaRating: number;
  appearances: number;
  wins: number;
  podiums: number;
  totalSupporters: number;
  totalClicks: number;
  createdAt: string;
}

export interface Arena {
  id: string;
  slug: string;
  number: number;
  name: string;
  theme: string;
  status: ArenaStatus;
  startsAt: string;
  endsAt: string;
  entryFeeCents: number;
  entrantCap: number;
  entrantCount: number;
  spectators: number;
  visits: number;
  prize: string;
}

export interface Standing {
  rank: number;
  previousRank: number | null;
  project: Project;
  supporters: number;
  clicks: number;
  score: number;
  /** Percentage share of the arena's total score. */
  share: number;
  momentum: number;
}

export interface ArenaResult {
  arena: Arena;
  champion: Standing;
  runnersUp: Standing[];
}

export interface ProjectHistoryEntry {
  arenaSlug: string;
  arenaNumber: number;
  arenaName: string;
  endedAt: string;
  rank: number;
  entrants: number;
  supporters: number;
  clicks: number;
  ratingDelta: number;
}
