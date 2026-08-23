import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { listAdminArenas } from '@/lib/admin-queries';
import { ButtonLink, Container, Label, Panel, StatusBadge } from '@/components/ui';
import { formatDateTime, formatNumber } from '@/lib/format';

export const metadata: Metadata = { title: 'Admin Arenas' };

export default async function AdminArenasPage() {
  await requireAdmin('/admin/arenas');
  const arenas = await listAdminArenas();

  return (
    <Container className="py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Label>Arenas</Label>
          <h1 className="mt-3 text-4xl font-semibold tracking-headline">Schedule</h1>
        </div>
        <ButtonLink href="/admin/arenas/new">Create Arena</ButtonLink>
      </div>
      <Panel className="mt-10">
        {arenas.map((row) => (
          <div key={row.arena.id} className="flex flex-col gap-4 border-b hairline px-5 py-5 last:border-b-0 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium">{row.arena.name}</h2>
                <StatusBadge status={row.arena.status} />
              </div>
              <p className="mt-2 num text-xs text-bone-faint">
                {row.occupied} / {row.arena.entrantCap} entries · Starts {formatDateTime(row.arena.startsAt)}
              </p>
              {row.pendingReview > 0 ? (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-gold">
                  {formatNumber(row.pendingReview)} pending review
                </p>
              ) : null}
            </div>
            <div className="flex gap-3">
              <Link
                href={`/admin/arenas/${row.arena.id}`}
                className="inline-flex h-8 items-center border border-white/15 px-3 font-mono text-[10px] uppercase tracking-widest"
              >
                Edit
              </Link>
              <AdminAction id={row.arena.id} action="close_registration" label="Close registration" />
            </div>
          </div>
        ))}
      </Panel>
    </Container>
  );
}

function AdminAction({ id, action, label }: { id: string; action: string; label: string }) {
  return (
    <form action={`/api/admin/arenas/${id}`} method="post">
      {/* progressive enhancement fallback is the edit page */}
      <Link
        href={`/admin/arenas/${id}?action=${action}`}
        className="inline-flex h-8 items-center border border-white/15 px-3 font-mono text-[10px] uppercase tracking-widest text-bone-dim"
      >
        {label}
      </Link>
    </form>
  );
}
