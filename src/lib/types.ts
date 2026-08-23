export type ArenaStatus = 'draft' | 'registration' | 'full' | 'live' | 'finished' | 'cancelled';

export type EntryStatus =
  | 'pending_payment'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'competing'
  | 'finished'
  | 'disqualified';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled' | 'overflow';

export type ProjectCategory =
  | 'AI'
  | 'SaaS'
  | 'Games'
  | 'Mobile'
  | 'Open Source'
  | 'Developer'
  | 'Design'
  | 'Web3'
  | 'Creator'
  | 'Community'
  | 'Other';

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  'AI',
  'SaaS',
  'Games',
  'Mobile',
  'Open Source',
  'Developer',
  'Design',
  'Web3',
  'Creator',
  'Community',
  'Other',
];

export const OPEN_ARENA_STATUSES: ArenaStatus[] = ['registration'];
export const PUBLIC_ARENA_STATUSES: ArenaStatus[] = ['registration', 'full', 'live', 'finished', 'cancelled'];
export const UPCOMING_ARENA_STATUSES: ArenaStatus[] = ['registration', 'full'];
export const ACTIVE_ENTRY_STATUSES: EntryStatus[] = [
  'pending_payment',
  'pending_review',
  'approved',
  'competing',
];
export const VISIBLE_ENTRY_STATUSES: EntryStatus[] = ['approved', 'competing', 'finished'];

export interface Builder {
  id: string;
  userId?: string;
  handle: string;
  displayName: string;
  email?: string;
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
  xUrl: string | null;
  githubUrl: string | null;
  builder: Builder;
  arenaRating: number;
  appearances: number;
  wins: number;
  podiums: number;
  highestRank?: number | null;
  totalSupporters: number;
  totalClicks: number;
  createdAt: string;
}

export interface ArenaScoringConfig {
  weights: { supporter: number; uniqueVisit: number };
  rating: {
    champion: number;
    top10: number;
    top25: number;
    top50: number;
    bottom50: number;
  };
}

export interface Arena {
  id: string;
  slug: string;
  number: number;
  name: string;
  theme: string;
  category: string;
  status: ArenaStatus;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  eligibilityText: string;
  scoringConfig: ArenaScoringConfig;
  entryFeeCents: number;
  entrantCap: number;
  entrantCount: number;
  spectators: number;
  visits: number;
  prize: string;
  championProjectId?: string | null;
}

export interface Standing {
  rank: number;
  previousRank: number | null;
  project: Project;
  supporters: number;
  clicks: number;
  impressions?: number;
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
  impressions?: number;
  ratingDelta: number;
  champion?: boolean;
}

export interface ArenaEntry {
  id: string;
  arenaId: string;
  projectId: string;
  builderId: string | null;
  paymentId: string | null;
  status: EntryStatus;
  score: number;
  currentRank: number | null;
  finalRank: number | null;
  supporterCount: number;
  uniqueVisitCount: number;
  impressionCount: number;
  rejectionReason: string | null;
  joinedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
}

export interface Payment {
  id: string;
  builderId: string;
  projectId: string;
  arenaId: string;
  provider: string;
  providerCheckoutId: string | null;
  providerPaymentId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  receiptUrl: string | null;
  refundReason: string | null;
  createdAt: string;
  confirmedAt: string | null;
  refundedAt: string | null;
}

export interface RankSnapshot {
  rank: number;
  score: number;
  label: string;
  capturedAt: string;
}

export interface ArenaRatingChange {
  arenaId: string;
  arenaName: string;
  ratingBefore: number;
  ratingChange: number;
  ratingAfter: number;
  createdAt: string;
}

export interface ProjectArenaStats {
  impressions: number;
  visits: number;
  supporters: number;
  score: number;
  rank: number | null;
  field: number;
  visitRate: number;
  ratingChange: number | null;
  rankHistory: RankSnapshot[];
  visitsOverTime: Array<{ t: string; visits: number }>;
}
