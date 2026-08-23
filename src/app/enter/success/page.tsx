import type { Metadata } from 'next';
import { ButtonLink, Container, Label, Panel, StatusBadge } from '@/components/ui';
import { getArena } from '@/lib/queries';
import { getBuilder } from '@/lib/auth';
import { getBuilderEntries } from '@/lib/builder-queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Entry received',
  robots: { index: false, follow: false },
};

export default async function EntrySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ arena?: string; session_id?: string }>;
}) {
  const { arena: arenaSlug } = await searchParams;
  const arena = arenaSlug ? await getArena(arenaSlug) : null;
  const ctx = await getBuilder();
  const entries = ctx ? await getBuilderEntries(ctx.builder.id) : [];
  const match = arena ? entries.find((item) => item.arena.slug === arena.slug) : entries[0];
  const status = match?.entry.status ?? 'pending_review';

  return (
    <Container className="py-16 sm:py-24">
      <div className="max-w-3xl">
        <Label>Entry</Label>
        <h1 className="mt-4 text-5xl font-semibold tracking-headline">
          {status === 'pending_review' || status === 'approved' ? 'Payment confirmed.' : 'Entry received.'}
        </h1>
        {arena ? (
          <p className="mt-4 font-mono text-xs uppercase tracking-widest text-bone-dim">{arena.name}</p>
        ) : null}

        <Panel className="mt-10">
          <div className="flex items-center justify-between border-b hairline px-5 py-3">
            <Label>Entry status</Label>
            <StatusBadge status={status} />
          </div>
          <div className="px-5 py-5 text-sm leading-relaxed text-bone-dim">
            {status === 'pending_review' ? (
              <p>Payment confirmed. Your Project will appear when approved.</p>
            ) : status === 'approved' ? (
              <p>Approved. Your Project is on the grid.</p>
            ) : match?.payment?.status === 'overflow' ? (
              <p>Payment succeeded but the Arena filled. An admin will resolve or refund this entry.</p>
            ) : (
              <p>If checkout completed, this page will update as soon as Stripe confirms the payment.</p>
            )}
          </div>
        </Panel>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {arena ? (
            <ButtonLink href={`/arena/${arena.slug}`} size="lg">
              View Arena
            </ButtonLink>
          ) : null}
          <ButtonLink href="/dashboard" variant="secondary" size="lg">
            Go to dashboard
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
