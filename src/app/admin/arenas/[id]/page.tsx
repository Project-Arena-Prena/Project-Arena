import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { getAdminArena } from '@/lib/admin-queries';
import { Container, Label, StatusBadge } from '@/components/ui';
import { ArenaForm } from '@/components/admin/arena-form';
import { formatDateTime, formatMoney } from '@/lib/format';

export const metadata: Metadata = { title: 'Edit Arena' };

export default async function AdminArenaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('/admin/arenas');
  const { id } = await params;
  const arena = await getAdminArena(id);
  if (!arena) notFound();

  return (
    <Container className="py-12">
      <div className="flex flex-wrap items-center gap-3">
        <Label>{arena.name}</Label>
        <StatusBadge status={arena.status} />
      </div>
      <h1 className="mt-3 text-4xl font-semibold tracking-headline">{arena.name}</h1>
      <p className="mt-3 num text-xs text-bone-faint">
        {arena.entrantCount} / {arena.entrantCap} · {formatMoney(arena.entryFeeCents)} · Starts{' '}
        {formatDateTime(arena.startsAt)} · Ends {formatDateTime(arena.endsAt)}
      </p>
      <div className="mt-10 max-w-2xl">
        <ArenaForm arena={arena} />
      </div>
    </Container>
  );
}
