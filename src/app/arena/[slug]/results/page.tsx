import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Trophy } from 'lucide-react';
import { Container, EmptyState, Label, Panel } from '@/components/ui';
import { ProjectLogo } from '@/components/project-logo';
import { formatNumber, formatRank } from '@/lib/format';
import { getArena, getFinalArenaStandings } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function ArenaResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [arena, standings] = await Promise.all([getArena(slug), getFinalArenaStandings(slug)]);
  if (!arena) notFound();

  if (arena.status !== 'finished') {
    return (
      <Container className="py-16">
        <EmptyState title="Results are not final" hint="The official record is published once this Arena closes." />
      </Container>
    );
  }

  const champion = standings[0];
  const totalSupporters = standings.reduce((total, item) => total + item.supporters, 0);
  const qualifiedVisits = standings.reduce((total, item) => total + item.clicks, 0);

  return (
    <Container className="py-12 sm:py-16">
      <div className="flex flex-col gap-5 border-b hairline pb-9 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Label>{arena.name}</Label>
          <h1 className="mt-3 text-4xl font-semibold tracking-headline sm:text-6xl">Final results</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-bone-dim">
            The permanent record for this Arena. Rankings, qualified visits, and Arena Rating changes are frozen at finalization.
          </p>
        </div>
        <Link href={`/arena/${arena.slug}`} className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-bone-dim hover:text-bone">
          Arena overview <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {champion ? (
        <Panel className="mt-10 border-gold/30 bg-gold/[0.04] p-6 sm:p-8">
          <Label className="text-gold">Champion</Label>
          <div className="mt-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center border border-gold/40 text-gold"><Trophy className="h-5 w-5" /></div>
            <ProjectLogo name={champion.project.name} logoUrl={champion.project.logoUrl} size="lg" />
            <div>
              <h2 className="text-3xl font-semibold tracking-headline">{champion.project.name}</h2>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-bone-dim">
                #{formatRank(champion.rank)} · {formatNumber(champion.supporters)} supporters · {formatNumber(champion.clicks)} qualified visits
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="mt-8 grid grid-cols-3 border hairline">
        <Stat label="Projects" value={formatNumber(standings.length)} />
        <Stat label="Supporters" value={formatNumber(totalSupporters)} />
        <Stat label="Qualified visits" value={formatNumber(qualifiedVisits)} />
      </div>

      <Panel className="mt-10 overflow-hidden">
        <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-4 border-b hairline px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-bone-faint sm:grid-cols-[56px_minmax(0,1fr)_96px_126px]">
          <span>Rank</span><span>Project</span><span className="hidden text-right sm:block">Support</span><span className="text-right">Qualified visits</span>
        </div>
        {standings.map((standing) => (
          <div key={standing.project.id} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-4 border-b hairline px-4 py-4 last:border-b-0 sm:grid-cols-[56px_minmax(0,1fr)_96px_126px]">
            <span className={standing.rank === 1 ? 'num text-gold' : 'num text-bone-dim'}>#{formatRank(standing.rank)}</span>
            <div className="flex min-w-0 items-center gap-3"><ProjectLogo name={standing.project.name} logoUrl={standing.project.logoUrl} size="sm" /><span className="truncate font-medium">{standing.project.name}</span></div>
            <span className="hidden text-right num text-bone-dim sm:block">{formatNumber(standing.supporters)}</span>
            <span className="text-right num">{formatNumber(standing.clicks)}</span>
          </div>
        ))}
      </Panel>

      <Link href="/hall-of-fame" className="mt-10 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-bone-dim hover:text-bone">
        <ArrowLeft className="h-3.5 w-3.5" /> Hall of Fame
      </Link>
    </Container>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-[104px] flex-col justify-between border-r hairline px-4 py-4 last:border-r-0 sm:px-5"><Label>{label}</Label><span className="num text-xl sm:text-2xl">{value}</span></div>;
}
