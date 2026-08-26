import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getAdminOverview } from '@/lib/admin-queries';
import { ButtonLink, Container, Label, Panel } from '@/components/ui';
import { formatMoney, formatNumber } from '@/lib/format';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminHomePage() {
  await requireAdmin('/admin');
  const overview = await getAdminOverview();

  return (
    <Container className="py-12 sm:py-16">
      <Label className="text-arena">Operations</Label>
      <h1 className="mt-4 text-[clamp(3.2rem,7vw,5.8rem)] font-semibold uppercase leading-[0.84] tracking-[-0.07em]">Arena control</h1>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel className="relative overflow-hidden border-white/30 p-6">
          <span className="absolute inset-y-0 left-0 w-1 bg-arena" aria-hidden />
          <Label>Current Arena</Label>
          {overview.current ? (
            <>
              <h2 className="mt-3 text-2xl font-semibold tracking-headline">{overview.current.arena.name}</h2>
              <p className="mt-4 num text-sm text-bone-dim">
                {overview.current.occupied} / {overview.current.arena.entrantCap} entries
              </p>
              <p className="num mt-2 text-sm">{formatMoney(overview.current.revenueCents)} revenue</p>
              <p className="num mt-2 text-sm">{formatNumber(overview.visitors)} visitors</p>
              <p className="num mt-2 text-sm">{formatNumber(overview.clicks)} project clicks</p>
              <div className="mt-5">
                <ButtonLink href={`/admin/arenas/${overview.current.arena.id}`} size="sm">
                  Manage
                </ButtonLink>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-bone-dim">No live Arena.</p>
          )}
        </Panel>
        <Panel className="border-white/30 p-6">
          <Label>Next Arena</Label>
          {overview.next ? (
            <>
              <h2 className="mt-3 text-2xl font-semibold tracking-headline">{overview.next.arena.name}</h2>
              <p className="mt-4 num text-sm text-bone-dim">
                {overview.next.occupied} / {overview.next.arena.entrantCap} entries
              </p>
              <p className="num mt-2 text-sm">{formatMoney(overview.next.revenueCents)} booked revenue</p>
              <div className="mt-5">
                <ButtonLink href={`/admin/arenas/${overview.next.arena.id}`} size="sm" variant="secondary">
                  Manage
                </ButtonLink>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-bone-dim">No upcoming Arena.</p>
          )}
        </Panel>
      </div>

      <div className="mt-8">
        <ButtonLink href="/admin/dry-run" variant="secondary">
          Run Arena clock dry-run
        </ButtonLink>
      </div>

      <div className="mt-8 grid grid-cols-2 border hairline md:grid-cols-4">
        <Alert href="/admin/entries?status=pending_review" label="Pending reviews" value={overview.pendingReviews} />
        <Alert href="/admin/payments" label="Failed payments" value={overview.failedPayments} />
        <Alert href="/admin/fraud" label="Open flags" value={overview.openFlags} />
        <Alert href="/admin/arenas" label="Needs attention" value={overview.next && overview.next.occupied === 0 ? 1 : 0} />
      </div>
    </Container>
  );
}

function Alert({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link href={href} className="border-r hairline px-5 py-5 hover:bg-white/[0.02]">
      <Label>{label}</Label>
      <p className={`num mt-3 text-2xl ${value > 0 ? 'text-arena' : 'text-bone'}`}>{value}</p>
    </Link>
  );
}
