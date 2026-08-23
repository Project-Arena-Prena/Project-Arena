import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireBuilder, builderOwnsProject } from '@/lib/auth';
import { getProjectArenaStats } from '@/lib/builder-queries';
import { getNextArenaForCategory } from '@/lib/queries';
import { percentileLabel, visitRate } from '@/lib/scoring';
import { ButtonLink, Container, EmptyState, Label, Panel, StatusBadge } from '@/components/ui';
import { formatNumber, formatRank } from '@/lib/format';
import { shareText, xIntentUrl } from '@/lib/share';
import { siteUrl } from '@/lib/stripe';
import { VisitsChart } from '@/components/dashboard/visits-chart';

export const metadata: Metadata = { title: 'Arena Performance' };

export default async function ProjectArenaPage({
  params,
}: {
  params: Promise<{ projectId: string; arenaId: string }>;
}) {
  const { projectId, arenaId } = await params;
  const ctx = await requireBuilder(`/dashboard/projects/${projectId}/arenas/${arenaId}`);
  if (!(await builderOwnsProject(ctx.builder.id, projectId)) && !ctx.isAdmin) notFound();
  const data = await getProjectArenaStats(projectId, arenaId);
  if (!data) notFound();

  const { arena, project, entry, stats } = data;
  const finished = arena.status === 'finished';
  const cancelled = arena.status === 'cancelled';
  const next = finished ? await getNextArenaForCategory(project.category, arena.slug) : null;
  const kind = finished ? (stats.rank === 1 ? 'champion' : 'final') : 'live';
  const url = `${siteUrl()}/arena/${arena.slug}`;
  const text = shareText(kind, {
    projectName: project.name,
    arenaName: arena.name,
    rank: stats.rank,
    field: stats.field,
    url,
  });

  return (
    <Container className="py-12">
      <Label>{arena.name}</Label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-semibold tracking-headline">{project.name}</h1>
        <StatusBadge status={cancelled ? 'cancelled' : finished ? 'finished' : entry.status} />
      </div>

      {entry.status === 'pending_review' ? (
        <Panel className="mt-8 p-6">
          <Label>Entry status</Label>
          <p className="mt-3 text-2xl font-semibold tracking-headline">Pending review</p>
          <p className="mt-2 text-sm text-bone-dim">Payment confirmed. We&apos;re reviewing your Project.</p>
        </Panel>
      ) : null}

      {entry.status === 'rejected' ? (
        <Panel className="mt-8 p-6">
          <Label>Entry status</Label>
          <p className="mt-3 text-2xl font-semibold tracking-headline">Rejected</p>
          <p className="mt-2 text-sm text-bone-dim">{entry.rejectionReason ?? 'This entry was not approved.'}</p>
        </Panel>
      ) : null}

      {cancelled ? (
        <Panel className="mt-8 p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-arena">Arena cancelled</p>
          <p className="mt-3 text-sm text-bone-dim">This Arena will not run. Affected entries are queued for refund review.</p>
        </Panel>
      ) : null}

      {['approved', 'competing', 'finished'].includes(entry.status) ? (
        <>
          <div className="mt-10 grid grid-cols-2 border hairline md:grid-cols-3">
            <Stat
              label={finished ? 'Final result' : 'Current rank'}
              value={stats.rank ? `#${formatRank(stats.rank)} / ${stats.field}` : '—'}
              sub={stats.rank ? percentileLabel(stats.rank, stats.field) : undefined}
              lead
            />
            <Stat label="Impressions" value={formatNumber(stats.impressions)} />
            <Stat label="Project visits" value={formatNumber(stats.visits)} />
            <Stat label="Supporters" value={formatNumber(stats.supporters)} />
            <Stat label="Visit rate" value={`${visitRate(stats.visits, stats.impressions)}%`} />
            <Stat
              label="Arena Rating"
              value={
                stats.ratingChange == null
                  ? '—'
                  : `${stats.ratingChange > 0 ? '+' : ''}${stats.ratingChange}`
              }
              tone={stats.ratingChange && stats.ratingChange > 0 ? 'text-gain' : stats.ratingChange && stats.ratingChange < 0 ? 'text-arena' : undefined}
            />
          </div>

          <div className="mt-12">
            <Label>Traffic</Label>
            <h2 className="mt-2 text-2xl font-semibold tracking-headline">Project visits over the Arena</h2>
            <div className="mt-6">
              {stats.visitsOverTime.length ? (
                <VisitsChart points={stats.visitsOverTime} />
              ) : (
                <EmptyState title="No visit series yet" hint="Outbound visits appear here as spectators click through." />
              )}
            </div>
          </div>

          {stats.rankHistory.length ? (
            <div className="mt-12">
              <Label>Rank history</Label>
              <Panel className="mt-4">
                {stats.rankHistory.map((snap) => (
                  <div key={`${snap.label}-${snap.capturedAt}`} className="flex items-center justify-between border-b hairline px-5 py-3 last:border-b-0">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">{snap.label}</span>
                    <span className="num text-sm">#{formatRank(snap.rank)}</span>
                  </div>
                ))}
                {finished && stats.rank ? (
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-gold">Final</span>
                    <span className="num text-sm text-gold">#{formatRank(stats.rank)}</span>
                  </div>
                ) : null}
              </Panel>
            </div>
          ) : null}

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href={xIntentUrl(text)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center border border-white/15 px-5 font-mono text-[11px] uppercase tracking-widest"
            >
              Share result
            </a>
            <ButtonLink href="/enter" variant="secondary">
              Enter another Arena
            </ButtonLink>
          </div>
        </>
      ) : null}

      {next ? (
        <Panel className="mt-16 p-6">
          <Label>Next for {project.name}</Label>
          <h2 className="mt-3 text-2xl font-semibold tracking-headline">{next.name}</h2>
          <p className="mt-2 text-sm text-bone-dim">
            {next.entrantCount} / {next.entrantCap} spots filled
          </p>
          <div className="mt-5">
            <ButtonLink href={`/enter?arena=${next.slug}&project=${project.id}`}>Enter next Arena</ButtonLink>
          </div>
        </Panel>
      ) : null}
    </Container>
  );
}

function Stat({
  label,
  value,
  sub,
  lead,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  lead?: boolean;
  tone?: string;
}) {
  return (
    <div className={`flex min-h-[120px] flex-col justify-between gap-3 border-r border-b hairline px-5 py-5 ${lead ? 'bg-white/[0.02]' : ''}`}>
      <Label>{label}</Label>
      <span className={`num text-2xl leading-none ${tone ?? 'text-bone'}`}>{value}</span>
      {sub ? <span className="font-mono text-[10px] uppercase tracking-widest text-arena">{sub}</span> : null}
    </div>
  );
}
