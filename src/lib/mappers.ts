import { parseScoringConfig } from './scoring';
import type {
  Arena,
  ArenaEntry,
  ArenaStatus,
  Builder,
  EntryStatus,
  Payment,
  PaymentStatus,
  Project,
  ProjectCategory,
  Standing,
} from './types';

export type Row = Record<string, unknown>;

export function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : Number(value) || fallback;
}

export function string(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export const PUBLIC_PROJECT_COLUMNS = [
  'id',
  'name',
  'slug',
  'tagline',
  'description',
  'logo_url',
  'website_url',
  'x_url',
  'github_url',
  'category',
  'arena_rating',
  'total_supporters',
  'total_project_visits',
  'arena_appearances',
  'championships',
  'highest_rank',
  'created_at',
].join(',');

const OCCUPIED = new Set(['pending_review', 'approved', 'competing']);

export function nested<T = Row>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return value as T;
}

export function projectFromRow(row: Row, builder?: Builder | null): Project {
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
    logoUrl: optionalString(row.logo_url),
    xUrl: optionalString(row.x_url),
    githubUrl: optionalString(row.github_url),
    builder: builder ?? {
      id: `builder-${slug}`,
      handle: slug,
      displayName: 'Project Builder',
      avatarUrl: null,
    },
    arenaRating: number(row.arena_rating, 1000),
    appearances: number(row.arena_appearances),
    wins: number(row.championships),
    podiums: 0,
    highestRank: row.highest_rank == null ? null : number(row.highest_rank),
    totalSupporters: number(row.total_supporters),
    totalClicks: number(row.total_project_visits),
    createdAt: string(row.created_at, new Date(0).toISOString()),
  };
}

export function occupiedCount(entries: Row[]): number {
  return entries.filter((entry) => OCCUPIED.has(string(entry.status))).length;
}

export function arenaFromRow(row: Row): Arena {
  const entries = Array.isArray(row.arena_entries) ? (row.arena_entries as Row[]) : [];
  const occupied = occupiedCount(entries);
  const visits = entries.reduce((sum, entry) => sum + number(entry.unique_visit_count), 0);
  return {
    id: string(row.id),
    slug: string(row.slug),
    number: number(row.number),
    name: string(row.name),
    theme: string(row.description),
    category: string(row.category, 'Open'),
    status: string(row.status, 'registration') as ArenaStatus,
    startsAt: string(row.starts_at),
    endsAt: string(row.ends_at),
    registrationOpensAt: optionalString(row.registration_opens_at),
    registrationClosesAt: optionalString(row.registration_closes_at),
    eligibilityText: string(row.eligibility_text),
    scoringConfig: parseScoringConfig(row.scoring_config),
    entryFeeCents: number(row.entry_price),
    prenaPaymentEnabled: row.prena_payment_enabled === true,
    prenaDiscountPercent: number(row.prena_discount_percent),
    rewardPoolEnabled: row.reward_pool_enabled === true,
    prenaEarlyRegistrationAt: optionalString(row.prena_early_registration_at),
    entrantCap: number(row.max_entries, 32),
    entrantCount: occupied,
    spectators: number(row.spectators),
    visits,
    prize: 'Champion badge, permanent Hall of Fame entry, and featured placement',
    championProjectId: optionalString(row.champion_project_id),
  };
}

export function standingFromRow(row: Row): Standing {
  return {
    rank: number(row.rank ?? row.current_rank ?? row.final_rank),
    previousRank: null,
    project: projectFromRow(row),
    supporters: number(row.supporter_count),
    clicks: number(row.unique_visit_count),
    impressions: number(row.impression_count),
    score: number(row.score),
    share: number(row.score_share),
    momentum: 0,
  };
}

export function entryFromRow(row: Row): ArenaEntry {
  return {
    id: string(row.id),
    arenaId: string(row.arena_id),
    projectId: string(row.project_id),
    builderId: optionalString(row.builder_id),
    paymentId: optionalString(row.payment_id),
    status: string(row.status) as EntryStatus,
    score: number(row.score),
    currentRank: row.current_rank == null ? null : number(row.current_rank),
    finalRank: row.final_rank == null ? null : number(row.final_rank),
    supporterCount: number(row.supporter_count),
    uniqueVisitCount: number(row.unique_visit_count),
    impressionCount: number(row.impression_count),
    rejectionReason: optionalString(row.rejection_reason),
    joinedAt: string(row.joined_at),
    approvedAt: optionalString(row.approved_at),
    rejectedAt: optionalString(row.rejected_at),
  };
}

export function paymentFromRow(row: Row): Payment {
  return {
    id: string(row.id),
    builderId: string(row.builder_id),
    projectId: string(row.project_id),
    arenaId: string(row.arena_id),
    provider: string(row.provider, 'stripe'),
    providerCheckoutId: optionalString(row.provider_checkout_id),
    providerPaymentId: optionalString(row.provider_payment_id),
    amount: number(row.amount),
    currency: string(row.currency, 'usd'),
    status: string(row.status) as PaymentStatus,
    receiptUrl: optionalString(row.receipt_url),
    refundReason: optionalString(row.refund_reason),
    createdAt: string(row.created_at),
    confirmedAt: optionalString(row.confirmed_at),
    refundedAt: optionalString(row.refunded_at),
  };
}

export function builderFromRow(row: Row): Builder {
  const email = string(row.email);
  const display = string(row.display_name, email.split('@')[0] || 'Builder');
  return {
    id: string(row.id),
    userId: optionalString(row.user_id) ?? undefined,
    handle: display.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'builder',
    displayName: display,
    email,
    avatarUrl: optionalString(row.avatar_url),
  };
}
