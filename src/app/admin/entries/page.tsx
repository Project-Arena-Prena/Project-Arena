import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { listAdminEntries, listAdminArenas } from '@/lib/admin-queries';
import { Container, Label, Panel, StatusBadge } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { EntryActions } from '@/components/admin/entry-actions';
import { PROJECT_CATEGORIES } from '@/lib/types';

export const metadata: Metadata = { title: 'Admin Entries' };

export default async function AdminEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ arena?: string; status?: string; category?: string }>;
}) {
  await requireAdmin('/admin/entries');
  const { arena, status, category } = await searchParams;
  const [rows, arenas] = await Promise.all([
    listAdminEntries({ arenaId: arena, status, category }),
    listAdminArenas(),
  ]);

  return (
    <Container className="py-12">
      <Label>Entries</Label>
      <h1 className="mt-3 text-4xl font-semibold tracking-headline">Review</h1>
      <form className="mt-8 flex flex-wrap gap-3">
        <select name="arena" defaultValue={arena ?? ''} className="h-10 border hairline bg-ink-950 px-3 font-mono text-[11px] uppercase">
          <option value="">All Arenas</option>
          {arenas.map((row) => (
            <option key={row.arena.id} value={row.arena.id}>
              {row.arena.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ''} className="h-10 border hairline bg-ink-950 px-3 font-mono text-[11px] uppercase">
          <option value="">All statuses</option>
          {['pending_review', 'approved', 'competing', 'rejected', 'finished'].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select name="category" defaultValue={category ?? ''} className="h-10 border hairline bg-ink-950 px-3 font-mono text-[11px] uppercase">
          <option value="">All categories</option>
          {PROJECT_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 border border-white/15 px-4 font-mono text-[10px] uppercase tracking-widest">
          Filter
        </button>
      </form>
      <Panel className="mt-8">
        {rows.map((row) => (
          <div key={row.entry.id} className="flex flex-col gap-4 border-b hairline px-5 py-5 last:border-b-0 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">{row.project.name}</span>
                <span className="label">{row.project.category}</span>
                <StatusBadge status={row.entry.status} />
              </div>
              <p className="mt-2 text-xs text-bone-faint">
                {row.arena.name}
                {row.payment ? ` · Paid ${formatMoney(row.payment.amount)}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/project/${row.project.slug}`}
                className="inline-flex h-8 items-center border border-white/15 px-3 font-mono text-[10px] uppercase tracking-widest"
              >
                View Project
              </Link>
              {row.entry.status === 'pending_review' ? <EntryActions id={row.entry.id} /> : null}
            </div>
          </div>
        ))}
      </Panel>
    </Container>
  );
}
