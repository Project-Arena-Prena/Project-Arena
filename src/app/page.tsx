import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { Leaderboard } from '@/components/leaderboard';
import { Reveal } from '@/components/reveal';
import {
  ButtonLink,
  Container,
  EmptyState,
  Label,
  Panel,
  Rule,
  SectionHeader,
  StatusBadge,
} from '@/components/ui';
import { formatMoney, formatNumber, formatRank, pad2 } from '@/lib/format';
import { getArenas, getLiveArena, getStandings, getTopRatedProjects } from '@/lib/queries';
import { PROJECT_CATEGORIES } from '@/lib/types';
import { cn } from '@/lib/cn';

export const metadata: Metadata = {
  title: { absolute: 'Project Arena — Where projects compete for attention' },
  description:
    'Live, timed Arenas where internet projects compete for spectators, visits, and reputation. Watch the standings move. Enter your project.',
};

const STEPS = [
  {
    n: '01',
    title: 'Enter',
    body: 'Submit your project and pay to enter a themed Arena.',
  },
  {
    n: '02',
    title: 'Compete',
    body: 'Spectators discover you, visit you, and back you. Rank moves live.',
  },
  {
    n: '03',
    title: 'Carry it',
    body: 'Wins, supporters, and Arena Rating stay on your project profile forever.',
  },
];

export default async function HomePage() {
  const [arena, { upcoming }, topRated] = await Promise.all([
    getLiveArena(),
    getArenas(),
    getTopRatedProjects(8),
  ]);
  const standings = arena ? await getStandings(arena.slug, 10) : [];

  const liveCells = arena
    ? [
        { label: 'Projects', value: formatNumber(arena.entrantCount), sub: `Cap ${arena.entrantCap}` },
        { label: 'Spectators', value: formatNumber(arena.spectators), sub: 'This Arena' },
        { label: 'Project visits', value: formatNumber(arena.visits), sub: 'Outbound' },
        { label: 'Entry', value: formatMoney(arena.entryFeeCents), sub: 'Per project' },
      ]
    : [];

  return (
    <>
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b hairline">
        <div
          className="grid-lines pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.85),transparent_85%)]"
          aria-hidden
        />
        <Container className="relative py-20 sm:py-28 lg:py-32">
          <Reveal>
            <Label>Where projects compete for attention</Label>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="mt-6 font-mono text-[clamp(1.7rem,7vw,84px)] font-semibold uppercase leading-[0.95] tracking-[0.14em] text-bone sm:tracking-[0.2em] lg:tracking-[0.26em]">
              Project Arena
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="mt-10 flex flex-col text-4xl font-semibold tracking-headline sm:text-5xl lg:text-[56px] lg:leading-[1.06]">
              <span className="text-bone-dim">The internet is building.</span>
              <span className="text-bone">See what&apos;s winning.</span>
            </div>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink
                href={arena ? `/arena/${arena.slug}` : '/arenas'}
                size="lg"
                className="w-full sm:w-auto"
              >
                Watch Live
              </ButtonLink>
              <ButtonLink href="/enter" variant="secondary" size="lg" className="w-full sm:w-auto">
                Enter the Arena
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <Rule className="mt-14" />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-4">
              <span className="label text-bone-dim">Discover</span>
              <span className="h-3 w-px bg-white/10" aria-hidden />
              <span className="label text-bone-dim">Compete</span>
              <span className="h-3 w-px bg-white/10" aria-hidden />
              <span className="label text-bone-dim">Get seen</span>
              {arena ? (
                <>
                  <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden />
                  <span className="label">
                    {formatNumber(arena.entrantCount)} projects on the clock
                  </span>
                </>
              ) : null}
            </div>
          </Reveal>
        </Container>
      </section>

      {/* ---------------------------------------------------------- live arena */}
      <section className="border-b hairline py-16 sm:py-20">
        <Container>
          {arena ? (
            <Reveal delay={0.1}>
              <Panel>
                <div className="flex flex-col gap-3 border-b hairline px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex items-center gap-3">
                    <h2 className="font-mono text-xs uppercase tracking-widest text-bone">
                      {arena.name.toUpperCase()}
                    </h2>
                    <StatusBadge status="live" />
                  </div>
                  <p className="max-w-xl text-xs text-bone-faint sm:text-right">{arena.theme}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4">
                  {liveCells.map((cell, i) => (
                    <div
                      key={cell.label}
                      className={cn(
                        'hairline flex flex-col gap-2 px-5 py-6 sm:px-6',
                        i % 2 === 1 && 'border-l',
                        i >= 2 && 'border-t md:border-t-0',
                        i > 0 && 'md:border-l',
                      )}
                    >
                      <Label>{cell.label}</Label>
                      <span className="num text-2xl leading-none tracking-tight text-bone sm:text-[28px]">
                        {cell.value}
                      </span>
                      <span className="label">{cell.sub}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-6 border-y hairline px-5 py-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-col gap-3">
                    <Label>Ends in</Label>
                    <Countdown target={arena.endsAt} size="lg" />
                  </div>
                  <div className="flex max-w-sm flex-col gap-2 lg:text-right">
                    <Label>Champion takes</Label>
                    <p className="text-xs text-bone-dim">{arena.prize}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-3">
                  <Label>Live standings</Label>
                  <Label>Top 10 of {formatNumber(arena.entrantCount)}</Label>
                </div>

                <Leaderboard standings={standings} arenaSlug={arena.slug} live />

                <Link
                  href={`/arena/${arena.slug}`}
                  className="group flex items-center justify-between px-5 py-4 transition-colors duration-200 hover:bg-white/[0.025] sm:px-6"
                >
                  <span className="font-mono text-[11px] uppercase tracking-widest text-bone">
                    View full Arena
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-bone-dim transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </Panel>
            </Reveal>
          ) : (
            <EmptyState
              title="No live Arena"
              hint="The next Arena is on the clock. Entries are open now."
            />
          )}
        </Container>
      </section>

      {/* -------------------------------------------------------- how it works */}
      <section className="border-b hairline py-16 sm:py-20">
        <Container>
          <SectionHeader eyebrow="Format" title="How it works" />
          <div className="grid grid-cols-1 border hairline md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.n}
                className={cn(
                  'hairline flex flex-col gap-4 p-6 sm:p-8',
                  i > 0 && 'border-t md:border-l md:border-t-0',
                )}
              >
                <span className="num text-xl leading-none text-bone-faint">{step.n}</span>
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-bone">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-bone-dim">{step.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* --------------------------------------------------------- categories */}
      <section className="border-b hairline py-16 sm:py-20">
        <Container>
          <SectionHeader eyebrow="Any project can enter" title="Not a directory. A competition." />
          <p className="max-w-xl text-sm leading-relaxed text-bone-dim">
            If it lives on the internet and someone can open it, it can compete. Themed Arenas
            rotate. The clock does not care what you built.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {PROJECT_CATEGORIES.map((category) => (
              <span
                key={category}
                className="border hairline px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-bone-dim"
              >
                {category}
              </span>
            ))}
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------ arena rating */}
      <section className="border-b hairline py-16 sm:py-20">
        <Container>
          <SectionHeader
            eyebrow="All time"
            title="Top Arena Rating"
            action={
              <Link
                href="/hall-of-fame"
                className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-bone-dim transition-colors duration-200 hover:text-bone"
              >
                Hall of Fame
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <Panel>
            <div className="hidden grid-cols-[44px_1fr_88px_72px_104px] items-center gap-4 border-b hairline px-4 py-2.5 md:grid">
              <span className="label">Pos</span>
              <span className="label">Project</span>
              <span className="label text-right">Arenas</span>
              <span className="label text-right">Wins</span>
              <span className="label text-right">Rating</span>
            </div>
            {topRated.map((project, i) => (
              <Link
                key={project.slug}
                href={`/project/${project.slug}`}
                className="grid grid-cols-[36px_1fr_auto] items-center gap-4 border-b hairline px-4 py-3.5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.025] md:grid-cols-[44px_1fr_88px_72px_104px]"
              >
                <span className={cn('num text-sm', i === 0 ? 'text-gold' : 'text-bone-dim')}>
                  {formatRank(i + 1)}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-medium tracking-tight text-bone">
                    {project.name}
                  </span>
                  <span className="label">{project.category}</span>
                </div>
                <span className="hidden num text-right text-sm text-bone-dim md:block">
                  {project.appearances}
                </span>
                <span className="hidden num text-right text-sm text-bone-dim md:block">
                  {project.wins}
                </span>
                <span className="num text-right text-sm text-bone">
                  {formatNumber(project.arenaRating)}
                </span>
              </Link>
            ))}
          </Panel>
        </Container>
      </section>

      {/* -------------------------------------------------------- next arenas */}
      <section className="border-b hairline py-16 sm:py-20">
        <Container>
          <SectionHeader
            eyebrow="On the schedule"
            title="Next Arenas"
            action={
              <Link
                href="/arenas"
                className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-bone-dim transition-colors duration-200 hover:text-bone"
              >
                All Arenas
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {upcoming.length > 0 ? (
            <Panel>
              {upcoming.map((next) => (
                <div
                  key={next.slug}
                  className="flex flex-col gap-5 border-b hairline px-5 py-5 last:border-b-0 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="num text-xs text-bone-faint">{pad2(next.number)}</span>
                      <Link
                        href={`/arena/${next.slug}`}
                        className="truncate text-[15px] font-medium tracking-tight text-bone transition-colors duration-200 hover:text-arena"
                      >
                        {next.name}
                      </Link>
                      <StatusBadge status="upcoming" />
                    </div>
                    <p className="text-xs text-bone-faint">{next.theme}</p>
                  </div>

                  <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
                    <div className="flex flex-col gap-1.5">
                      <Label>Entrants</Label>
                      <span className="num text-sm text-bone-dim">
                        {next.entrantCount}/{next.entrantCap}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Entry</Label>
                      <span className="num text-sm text-bone-dim">
                        {next.entryFeeCents === 0 ? 'Free' : formatMoney(next.entryFeeCents)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Starts in</Label>
                      <Countdown target={next.startsAt} size="sm" showDays />
                    </div>
                    <ButtonLink href={`/enter?arena=${next.slug}`} variant="secondary" size="sm">
                      Enter
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </Panel>
          ) : (
            <EmptyState title="No Arenas scheduled" hint="The next slate is being drawn up." />
          )}
        </Container>
      </section>

      {/* --------------------------------------------------------- closing cta */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-10">
            <div className="flex flex-col gap-3">
              <Label>Ready</Label>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-headline sm:text-4xl">
                Your project is invisible until it competes.
              </h2>
            </div>
            <ButtonLink href="/enter" size="lg" className="w-full shrink-0 md:w-auto">
              Enter the Arena
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
