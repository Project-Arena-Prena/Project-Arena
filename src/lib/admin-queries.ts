import { createAdminClient } from './supabase/server';
import { reconcileArenas } from './arena-lifecycle';
import {
  arenaFromRow,
  entryFromRow,
  nested,
  number,
  paymentFromRow,
  projectFromRow,
  string,
  type Row,
} from './mappers';
import type { Arena, ArenaEntry, Payment, Project } from './types';

export interface AdminArenaRow {
  arena: Arena;
  occupied: number;
  pendingReview: number;
  revenueCents: number;
}

export interface AdminEntryRow {
  entry: ArenaEntry;
  arena: Arena;
  project: Project;
  payment: Payment | null;
  category: string;
}

export interface AdminOverview {
  current: AdminArenaRow | null;
  next: AdminArenaRow | null;
  pendingReviews: number;
  failedPayments: number;
  openFlags: number;
  visitors: number;
  clicks: number;
}

export async function listAdminArenas(): Promise<AdminArenaRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  await reconcileArenas();
  const { data } = await admin
    .from('arenas')
    .select('*, arena_entries(status, unique_visit_count), payments(amount, status)')
    .order('starts_at', { ascending: false });
  return ((data ?? []) as Row[]).map((row) => toAdminArena(row));
}

function toAdminArena(row: Row): AdminArenaRow {
  const arena = arenaFromRow(row);
  const entries = Array.isArray(row.arena_entries) ? (row.arena_entries as Row[]) : [];
  const payments = Array.isArray(row.payments) ? (row.payments as Row[]) : [];
  return {
    arena,
    occupied: arena.entrantCount,
    pendingReview: entries.filter((entry) => string(entry.status) === 'pending_review').length,
    revenueCents: payments
      .filter((payment) => ['paid', 'overflow'].includes(string(payment.status)))
      .reduce((sum, payment) => sum + number(payment.amount), 0),
  };
}

export async function getAdminArena(id: string): Promise<Arena | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from('arenas').select('*, arena_entries(status, unique_visit_count)').eq('id', id).maybeSingle();
  return data ? arenaFromRow(data as Row) : null;
}

export async function listAdminEntries(filters: {
  arenaId?: string;
  status?: string;
  category?: string;
}): Promise<AdminEntryRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  let query = admin
    .from('arena_entries')
    .select('*, arenas:arena_id(*), projects:project_id(*), payments:payment_id(*)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (filters.arenaId) query = query.eq('arena_id', filters.arenaId);
  if (filters.status) query = query.eq('status', filters.status);
  const { data } = await query;
  return ((data ?? []) as Row[]).flatMap((row) => {
    const arenaRow = nested(row.arenas);
    const projectRow = nested(row.projects);
    if (!arenaRow || !projectRow) return [];
    const project = projectFromRow(projectRow);
    if (filters.category && project.category !== filters.category) return [];
    const paymentRow = nested(row.payments);
    return [
      {
        entry: entryFromRow(row),
        arena: arenaFromRow({ ...arenaRow, arena_entries: [] }),
        project,
        payment: paymentRow ? paymentFromRow(paymentRow) : null,
        category: project.category,
      },
    ];
  });
}

export async function listAdminPayments(): Promise<Array<Payment & { arenaName: string; projectName: string }>> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from('payments')
    .select('*, arenas:arena_id(name), projects:project_id(name)')
    .order('created_at', { ascending: false })
    .limit(200);
  return ((data ?? []) as Row[]).map((row) => ({
    ...paymentFromRow(row),
    arenaName: string(nested(row.arenas)?.name),
    projectName: string(nested(row.projects)?.name),
  }));
}

export async function listAdminProjects(): Promise<Project[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin.from('projects').select('*').order('created_at', { ascending: false }).limit(200);
  return ((data ?? []) as Row[]).map((row) => projectFromRow(row));
}

export async function listFraudFlags(): Promise<Array<{
  id: string;
  arenaId: string | null;
  projectId: string | null;
  eventType: string;
  reason: string;
  severity: string;
  status: string;
  createdAt: string;
  arenaName: string;
  projectName: string;
}>> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from('fraud_flags')
    .select('*, arenas:arena_id(name), projects:project_id(name)')
    .order('created_at', { ascending: false })
    .limit(200);
  return ((data ?? []) as Row[]).map((row) => ({
    id: string(row.id),
    arenaId: row.arena_id ? string(row.arena_id) : null,
    projectId: row.project_id ? string(row.project_id) : null,
    eventType: string(row.event_type),
    reason: string(row.reason),
    severity: string(row.severity),
    status: string(row.status),
    createdAt: string(row.created_at),
    arenaName: string(nested(row.arenas)?.name, '—'),
    projectName: string(nested(row.projects)?.name, '—'),
  }));
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const arenas = await listAdminArenas();
  const current = arenas.find((row) => row.arena.status === 'live') ?? null;
  const next =
    arenas.find((row) => row.arena.status === 'registration' || row.arena.status === 'full') ?? null;
  const admin = createAdminClient();
  let failedPayments = 0;
  let openFlags = 0;
  if (admin) {
    const [{ count: failed }, { count: flags }] = await Promise.all([
      admin.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      admin.from('fraud_flags').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ]);
    failedPayments = failed ?? 0;
    openFlags = flags ?? 0;
  }
  return {
    current,
    next,
    pendingReviews: arenas.reduce((sum, row) => sum + row.pendingReview, 0),
    failedPayments,
    openFlags,
    visitors: current?.arena.spectators ?? 0,
    clicks: current?.arena.visits ?? 0,
  };
}

export async function getAdminAnalytics(): Promise<{
  fillRate: number;
  checkoutConversion: number;
  revenuePerArena: number;
  visitsPerProject: number;
  shareRate: number;
  repeatEntryRate: number;
}> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      fillRate: 0,
      checkoutConversion: 0,
      revenuePerArena: 0,
      visitsPerProject: 0,
      shareRate: 0,
      repeatEntryRate: 0,
    };
  }
  const [{ data: arenas }, { data: payments }, { data: events }, { data: entries }] = await Promise.all([
    admin.from('arenas').select('id, max_entries, arena_entries(status)').neq('status', 'draft'),
    admin.from('payments').select('amount, status, arena_id'),
    admin.from('analytics_events').select('name'),
    admin.from('arena_entries').select('builder_id, status'),
  ]);
  const arenaRows = (arenas ?? []) as Row[];
  const fill =
    arenaRows.length === 0
      ? 0
      : arenaRows.reduce((sum, row) => {
          const cap = number(row.max_entries, 1);
          const occupied = ((row.arena_entries as Row[]) ?? []).filter((entry) =>
            ['pending_review', 'approved', 'competing', 'finished'].includes(string(entry.status)),
          ).length;
          return sum + occupied / cap;
        }, 0) / arenaRows.length;

  const started = ((events ?? []) as Row[]).filter((row) => string(row.name) === 'checkout_started').length;
  const completed = ((events ?? []) as Row[]).filter((row) => string(row.name) === 'checkout_completed').length;
  const paid = ((payments ?? []) as Row[]).filter((row) => string(row.status) === 'paid');
  const revenue = paid.reduce((sum, row) => sum + number(row.amount), 0);
  const shares = ((events ?? []) as Row[]).filter((row) => string(row.name) === 'ranking_shared').length;
  const results = ((events ?? []) as Row[]).filter((row) => string(row.name) === 'result_viewed').length;
  const builders = new Map<string, number>();
  for (const row of (entries ?? []) as Row[]) {
    const id = string(row.builder_id);
    if (!id) continue;
    builders.set(id, (builders.get(id) ?? 0) + 1);
  }
  const repeats = [...builders.values()].filter((count) => count > 1).length;

  return {
    fillRate: Math.round(fill * 1000) / 10,
    checkoutConversion: started ? Math.round((completed / started) * 1000) / 10 : 0,
    revenuePerArena: arenaRows.length ? Math.round(revenue / arenaRows.length) : 0,
    visitsPerProject: 0,
    shareRate: results ? Math.round((shares / results) * 1000) / 10 : 0,
    repeatEntryRate: builders.size ? Math.round((repeats / builders.size) * 1000) / 10 : 0,
  };
}
