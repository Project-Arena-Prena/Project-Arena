import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { Leaderboard } from '@/components/leaderboard';
import { ChampionPanel } from '@/components/arena/champion-panel';
import { EntrantGrid } from '@/components/arena/entrant-grid';
import { Reveal } from '@/components/reveal';
import { TimingStrip } from '@/components/arena/timing-strip';
import {
  ButtonLink,
  Container,
  EmptyState,
  Label,
  LiveDot,
  Panel,
  SectionHeader,
  StatusBadge,
} from '@/components/ui';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { trackEvent } from '@/lib/analytics';
import { getAllArenaSlugs, getArena, getLiveArena, getStandings } from '@/lib/queries';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getAllArenaSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const arena = await getArena(slug);
  if (!arena) return { title: 'Arena Not Found' };
  return {
    title: arena.name,
    description: arena.theme,
    openGraph: {
      title: `${arena.name} — Project Arena`,
      description: arena.theme,
      type: 'website',
    },
  };
}

const CLOCK_LABEL: Record<string, string> = {
  live: 'Ends In',
  registration: 'Starts In',
  full: 'Starts In',
  upcoming: 'Starts In',
  finished: 'Final',
  cancelled: 'Cancelled',
  draft: 'Draft',
};

export default async function ArenaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const arena = await getArena(slug);
  if (!arena) notFound();

  const [standings, liveArena] = await Promise.all([getStandings(slug), getLiveArena()]);
  await trackEvent('arena_viewed', { arenaId: arena.id });

  const isLive = arena.status === 'live';
  const isUpcoming = arena.status === 'registration' || arena.status === 'full';
  const isFull = arena.status === 'full' || arena.entrantCount >= arena.entrantCap;
  const isCancelled = arena.status === 'cancelled';
  const champion = arena.status === 'finished' ? standings[0] : undefined;
  const slotsLeft = Math.max(0, arena.entrantCap - arena.entrantCount);
  const entrants = standings
    .map((s) => s.project)
    .sort((a, b) => a.name.localeCompare(b.name));
  const supporterCount = standings.reduce((total, row) => total + row.supporters, 0);

  return (
    <div className="pb-20">
      <section className="border-b hairline">
        <Container className="flex flex-col gap-10 py-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16 lg:py-14">
          <Reveal className="flex min-w-0 flex-col gap-4">
            {arena.number > 0 ? <Label>Arena #{arena.number.toString().padStart(3, '0')}</Label> : null}
            <h1 className="text-[34px] font-semibold leading-[0.95] tracking-headline sm:text-5xl lg:text-6xl">
              {arena.name}
            </h1>
            <p className="max-w-xl text-lg font-medium leading-relaxed text-bone sm:text-xl">
              {arena.entrantCount} projects. 48 hours. One champion.
            </p>
            <p className="max-w-xl text-sm leading-relaxed text-bone-dim">{arena.theme}</p>
          </Reveal>

          <Reveal delay={0.06} className="flex shrink-0 flex-col gap-4 lg:items-end">
            <div className="flex items-center gap-3">
              <StatusBadge status={arena.status} />
              <Label>{CLOCK_LABEL[arena.status]}</Label>
            </div>
            {isLive ? <Countdown target={arena.endsAt} size="lg" /> : null}
            {isUpcoming && !isCancelled ? <Countdown target={arena.startsAt} size="lg" showDays /> : null}
            {arena.status === 'finished' || isCancelled ? (
              <span className="num text-3xl uppercase leading-none tracking-tight text-bone-dim sm:text-4xl">
                {isCancelled ? 'Cancelled' : formatDate(arena.endsAt)}
              </span>
            ) : null}
          </Reveal>
        </Container>
      </section>

      <section className="border-b hairline">
        <Container>
          <TimingStrip arena={arena} supporters={supporterCount} />
        </Container>
      </section>

      <section className="border-b hairline">
        <Container className="flex flex-col gap-1.5 py-4 sm:flex-row sm:items-baseline sm:gap-5">
          <Label className="shrink-0">Champion Takes</Label>
          <p className="text-sm text-bone-dim">{arena.prize}</p>
        </Container>
      </section>

      <Container className="pt-10 sm:pt-12">
        {isCancelled ? (
          <Reveal delay={0.1}>
            <EmptyState title="Arena cancelled" hint="This Arena will not run. Entered Projects are queued for refund review." />
          </Reveal>
        ) : isUpcoming ? (
          <Reveal delay={0.1} className="flex flex-col gap-10">
            <Panel className="flex flex-col gap-6 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
              <div className="flex flex-col gap-2.5">
                <Label>{isFull ? 'Arena full' : 'Slots Remaining'}</Label>
                <div className="flex items-baseline gap-2.5">
                  <span className="num text-4xl leading-none tracking-tight text-bone sm:text-5xl">
                    {formatNumber(slotsLeft)}
                  </span>
                  <span className="num text-sm text-bone-faint">of {arena.entrantCap}</span>
                </div>
                <span className="hidden font-mono text-[9px] uppercase tracking-widest text-bone-faint sm:block">
                  1 support = 1 pt · 1 unique visit = 2 pts
                </span>
                <p className="text-xs text-bone-dim">
                  {isFull
                    ? `${arena.entrantCap} / ${arena.entrantCap} entered. Checkout is closed.`
                    : `Entry ${arena.entryFeeCents === 0 ? 'is free' : formatMoney(arena.entryFeeCents)}. The grid closes when it is full.`}
                </p>
              </div>
              {isFull ? (
                <ButtonLink href="/arenas" variant="secondary" size="lg" className="w-full sm:w-auto">
                  View other Arenas
                </ButtonLink>
              ) : (
                <ButtonLink href={`/enter?arena=${arena.slug}`} size="lg" className="w-full sm:w-auto">
                  Enter This Arena
                </ButtonLink>
              )}
            </Panel>

            <div>
              <SectionHeader
                eyebrow="Confirmed Entrants"
                title="On the grid"
                action={
                  <span className="num hidden text-xs text-bone-faint sm:block">
                    {formatNumber(entrants.length)} confirmed
                  </span>
                }
              />
              {entrants.length > 0 ? (
                <EntrantGrid entrants={entrants} />
              ) : (
                <EmptyState
                  title="Grid empty"
                  hint="No Projects confirmed yet. The first entry sets the pace."
                />
              )}
            </div>
          </Reveal>
        ) : (
          <Reveal delay={0.1} className="flex flex-col gap-10">
            {champion ? <ChampionPanel standing={champion} /> : null}

            <Panel>
              <div className="flex items-center justify-between gap-4 border-b hairline px-4 py-3">
                <div className="flex items-baseline gap-2.5">
                  <Label>{isLive ? 'Live Standings' : 'Final Standings'}</Label>
                  <span className="num text-[10px] tracking-widest text-bone-faint">
                    {formatNumber(standings.length)} Projects
                  </span>
                </div>
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5">
                    <LiveDot />
                    <Label className="text-live/80">Updating</Label>
                  </span>
                ) : null}
              </div>

              {isLive ? (
                <div className="border-b hairline px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-bone-faint">
                  Scoring · 1 support = 1 pt · 1 unique visit = 2 pts
                </div>
              ) : null}

              {standings.length > 0 ? (
                <div className="overflow-x-auto">
                  <Leaderboard standings={standings} arenaSlug={arena.slug} live={isLive} />
                </div>
              ) : (
                <div className="p-4">
                  <EmptyState title="No standings" hint="This Arena has no recorded entries." />
                </div>
              )}
            </Panel>
          </Reveal>
        )}
      </Container>

      <Container>
        <div className="mt-12 flex flex-col gap-4 border-t hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/arenas"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-bone-faint transition-colors duration-200 hover:text-bone"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Arenas
          </Link>
          {liveArena && liveArena.slug !== arena.slug ? (
            <Link
              href={`/arena/${liveArena.slug}`}
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-bone-dim transition-colors duration-200 hover:text-bone"
            >
              <LiveDot />
              {liveArena.name}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              href="/hall-of-fame"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-bone-dim transition-colors duration-200 hover:text-bone"
            >
              Hall of Fame
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </Container>
    </div>
  );
}
