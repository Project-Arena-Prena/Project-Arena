import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Eye,
  MousePointerClick,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { ArenaStage } from '@/components/home/arena-stage';
import { Leaderboard } from '@/components/leaderboard';
import { Reveal } from '@/components/reveal';
import {
  ButtonLink,
  Container,
  EmptyState,
  Label,
  Panel,
  SectionHeader,
  StatusBadge,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCompact, formatMoney, formatNumber, formatRank, pad2 } from '@/lib/format';
import { getArenas, getLiveArena, getStandings, getTopRatedProjects } from '@/lib/queries';
import { PROJECT_CATEGORIES } from '@/lib/types';

export const metadata: Metadata = {
  title: { absolute: 'Project Arena — Where projects compete for attention' },
  description:
    'Enter live, timed competitions where internet projects earn supporters, measurable visits, and lasting reputation.',
};

const OUTCOMES = [
  {
    icon: MousePointerClick,
    title: 'Attention you can measure',
    body: 'See unique visits, supporters, score, and rank move while the Arena is live.',
    metric: 'Real traffic',
  },
  {
    icon: Users,
    title: 'An audience with intent',
    body: 'Get discovered by spectators who came specifically to find and compare new projects.',
    metric: 'Active discovery',
  },
  {
    icon: Trophy,
    title: 'Reputation that compounds',
    body: 'Every result becomes part of your public record and long-term Arena Rating.',
    metric: 'Lasting proof',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Choose your Arena',
    body: 'Pick an open field that fits your project, then lock in your Arena Entry.',
  },
  {
    n: '02',
    title: 'Rally your audience',
    body: 'Share your entry. Supporters visit, back projects, and move the standings live.',
  },
  {
    n: '03',
    title: 'Earn the result',
    body: 'Finish with measurable traffic, a permanent record, and a stronger Arena Rating.',
  },
];

export default async function HomePage() {
  const [arena, { upcoming }, topRated] = await Promise.all([
    getLiveArena(),
    getArenas(),
    getTopRatedProjects(8),
  ]);
  const allStandings = arena ? await getStandings(arena.slug) : [];
  const standings = allStandings.slice(0, 5);
  const supporterCount = allStandings.reduce((total, row) => total + row.supporters, 0);

  const liveCells = arena
    ? [
        {
          icon: Zap,
          label: 'Projects competing',
          value: formatNumber(arena.entrantCount),
          sub: 'On the clock',
        },
        {
          icon: Users,
          label: 'Supporters',
          value: formatCompact(supporterCount),
          sub: 'Backing projects',
        },
        {
          icon: MousePointerClick,
          label: 'Project visits',
          value: formatCompact(arena.visits),
          sub: 'Outbound traffic',
        },
        {
          icon: Eye,
          label: 'Spectators',
          value: formatCompact(arena.spectators),
          sub: 'Watching live',
        },
      ]
    : [];

  const stageStandings = standings.slice(0, 4).map((standing) => ({
    rank: standing.rank,
    slug: standing.project.slug,
    name: standing.project.name,
    category: standing.project.category,
    logoUrl: standing.project.logoUrl,
    score: standing.score,
    share: standing.share,
    momentum: standing.momentum,
  }));

  return (
    <>
      <section className="relative overflow-hidden border-b hairline">
        <div
          className="grid-lines pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent_92%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-[20%] top-[-35%] h-[760px] w-[760px] rounded-full bg-arena/[0.08] blur-[120px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-[-20%] top-[20%] h-[620px] w-[620px] rounded-full bg-live/[0.035] blur-[130px]"
          aria-hidden
        />

        <Container className="relative py-14 sm:py-20 lg:py-24 xl:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(390px,0.8fr)] lg:gap-12 xl:gap-20">
            <div>
              <Reveal>
                <div className="flex flex-wrap items-center gap-3">
                  {arena ? <StatusBadge status="live" /> : <Label>Entries are open</Label>}
                  <span className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                    Where the internet earns the spotlight
                  </span>
                </div>
              </Reveal>

              <Reveal delay={0.05}>
                <h1 className="mt-7 max-w-4xl text-[clamp(3.35rem,7.4vw,86px)] font-semibold uppercase leading-[0.88] tracking-[-0.065em] text-bone">
                  <span className="block">Where projects</span>
                  <span className="block text-bone-dim">compete for</span>
                  <span className="relative inline-block text-arena">
                    attention.
                    <span
                      className="absolute -bottom-2 left-0 h-px w-full bg-gradient-to-r from-arena via-arena/50 to-transparent"
                      aria-hidden
                    />
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={0.1}>
                <p className="mt-8 max-w-xl text-base leading-relaxed text-bone-dim sm:text-lg">
                  Enter a timed Arena, rally supporters, earn measurable visits, and build a
                  competitive record that lasts beyond launch day.
                </p>
              </Reveal>

              <Reveal delay={0.15}>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <ButtonLink href="/enter" size="lg" className="group w-full sm:w-auto">
                    Enter your project
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </ButtonLink>
                  <ButtonLink
                    href={arena ? `/arena/${arena.slug}` : '/arenas'}
                    variant="secondary"
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    {arena ? 'Watch live Arena' : 'Explore Arenas'}
                  </ButtonLink>
                </div>
              </Reveal>

              <Reveal delay={0.2}>
                <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[9px] uppercase tracking-widest text-bone-faint">
                  <span>Rank is earned, never bought</span>
                  <span className="h-3 w-px bg-white/10" aria-hidden />
                  <span>Every score is public</span>
                </div>
              </Reveal>
            </div>

            <ArenaStage
              arena={
                arena
                  ? {
                      slug: arena.slug,
                      name: arena.name,
                      endsAt: arena.endsAt,
                      entrantCount: arena.entrantCount,
                    }
                  : null
              }
              standings={stageStandings}
            />
          </div>

          {arena ? (
            <Reveal delay={0.24}>
              <div className="mt-14 grid grid-cols-2 border border-white/[0.08] bg-ink-950/55 backdrop-blur-sm sm:mt-16 lg:grid-cols-4">
                {liveCells.map((cell, index) => {
                  const Icon = cell.icon;
                  return (
                    <div
                      key={cell.label}
                      className={cn(
                        'relative flex min-w-0 flex-col gap-2 px-4 py-5 sm:px-5',
                        index % 2 === 1 && 'border-l hairline',
                        index >= 2 && 'border-t hairline lg:border-t-0',
                        index > 0 && 'lg:border-l lg:hairline',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-arena" aria-hidden />
                        <Label className="truncate">{cell.label}</Label>
                      </div>
                      <span className="num text-2xl leading-none tracking-tight text-bone sm:text-3xl">
                        {cell.value}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-bone-faint">
                        {cell.sub}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Reveal>
          ) : null}
        </Container>

        <div
          className="relative overflow-x-auto border-t hairline bg-white/[0.015] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          tabIndex={0}
          role="region"
          aria-label="Project categories"
        >
          <Container className="flex min-w-max items-center gap-3 py-3 sm:min-w-0 sm:flex-wrap">
            <span className="mr-1 font-mono text-[9px] uppercase tracking-widest text-arena">
              Built to compete
            </span>
            {PROJECT_CATEGORIES.map((category) => (
              <span key={category} className="flex items-center gap-3">
                <span className="h-1 w-1 bg-white/20" aria-hidden />
                <span className="font-mono text-[9px] uppercase tracking-widest text-bone-faint">
                  {category}
                </span>
              </span>
            ))}
          </Container>
        </div>
      </section>

      <section className="border-b hairline py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Reveal>
                <Label>Why enter</Label>
                <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-headline text-bone sm:text-4xl">
                  Turn a launch moment into momentum.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-bone-dim sm:text-base">
                  An Arena gives people a reason to discover your work now—and a public result they
                  can trust later.
                </p>
              </Reveal>
            </div>

            <div className="grid gap-px border border-white/[0.08] bg-white/[0.08] sm:grid-cols-3">
              {OUTCOMES.map((outcome, index) => {
                const Icon = outcome.icon;
                return (
                  <Reveal key={outcome.title} delay={index * 0.06} className="h-full">
                    <article className="group flex h-full min-h-[255px] flex-col bg-ink-950 p-5 transition-colors hover:bg-ink-900 sm:p-6">
                      <div className="flex items-center justify-between">
                        <span className="flex h-10 w-10 items-center justify-center border border-arena/25 bg-arena/[0.06] text-arena">
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="num text-xs text-bone-dim">0{index + 1}</span>
                      </div>
                      <div className="mt-auto pt-10">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-arena">
                          {outcome.metric}
                        </span>
                        <h3 className="mt-3 text-lg font-semibold tracking-tight text-bone">
                          {outcome.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-bone-dim">{outcome.body}</p>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </Container>
      </section>

      <section className="relative overflow-hidden border-b hairline py-16 sm:py-20 lg:py-24">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(47,224,138,0.045),transparent_34%)]"
          aria-hidden
        />
        <Container className="relative">
          <SectionHeader
            eyebrow={arena ? 'Happening now' : 'Live competition'}
            title={arena ? 'The field is moving.' : 'The next field is forming.'}
            action={arena ? <StatusBadge status="live" /> : undefined}
          />

          {arena ? (
            <Reveal delay={0.05}>
              <Panel className="overflow-hidden border-white/[0.12] shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
                <div className="flex flex-col gap-5 border-b hairline px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="num text-xs text-bone-faint">ARENA {pad2(arena.number)}</span>
                      <h3 className="text-xl font-semibold tracking-tight text-bone sm:text-2xl">
                        {arena.name}
                      </h3>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-bone-dim">
                      {arena.theme}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 lg:items-end">
                    <Label>Closes in</Label>
                    <Countdown target={arena.endsAt} size="sm" />
                  </div>
                </div>

                <Leaderboard standings={standings} arenaSlug={arena.slug} live />

                <div className="grid border-t hairline sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="px-5 py-4 sm:px-6">
                    <span className="label">Champion takes</span>
                    <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-bone-dim">
                      {arena.prize}
                    </p>
                  </div>
                  <Link
                    href={`/arena/${arena.slug}`}
                    className="group flex min-h-14 items-center justify-between border-t hairline px-5 font-mono text-[10px] uppercase tracking-widest text-bone transition-colors hover:bg-white/[0.03] sm:h-full sm:min-w-[220px] sm:justify-center sm:gap-3 sm:border-l sm:border-t-0 sm:px-6"
                  >
                    Full standings
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </Panel>
            </Reveal>
          ) : (
            <EmptyState
              title="No live Arena"
              hint="Entries are open now. Join the next field before it fills."
            />
          )}
        </Container>
      </section>

      <section className="border-b hairline py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeader eyebrow="The format" title="Three steps. One live field." />
          <div className="grid border border-white/[0.08] md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Reveal key={step.n} delay={index * 0.06} className="h-full">
                <article
                  className={cn(
                    'group relative flex h-full min-h-[250px] flex-col overflow-hidden p-6 sm:p-8',
                    index > 0 && 'border-t hairline md:border-l md:border-t-0',
                  )}
                >
                  <span
                    className="pointer-events-none absolute -right-3 -top-7 num text-[110px] leading-none tracking-[-0.1em] text-white/[0.025] transition-colors group-hover:text-arena/[0.045]"
                    aria-hidden
                  >
                    {step.n}
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="num text-xl text-arena">{step.n}</span>
                    {index < STEPS.length - 1 ? (
                      <ArrowRight className="h-4 w-4 text-bone-faint" aria-hidden />
                    ) : (
                      <Trophy className="h-4 w-4 text-gold" aria-hidden />
                    )}
                  </div>
                  <div className="relative mt-auto pt-12">
                    <h3 className="font-mono text-[11px] uppercase tracking-widest text-bone">
                      {step.title}
                    </h3>
                    <p className="mt-3 max-w-sm text-sm leading-relaxed text-bone-dim">{step.body}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
          <div className="mt-6 flex flex-col items-start justify-between gap-4 border-l border-arena/60 pl-4 sm:flex-row sm:items-center">
            <p className="max-w-2xl text-sm leading-relaxed text-bone-dim">
              Entry buys a place in the competition—not a higher rank. The field decides what wins.
            </p>
            <Link
              href="/enter"
              className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-bone"
            >
              See entry options
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Container>
      </section>

      <section className="border-b hairline py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeader
            eyebrow="All-time signal"
            title="Reputation has a leaderboard."
            action={
              <Link
                href="/hall-of-fame"
                className="group hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-bone-dim transition-colors hover:text-bone sm:inline-flex"
              >
                Hall of Fame
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            }
          />

          {topRated.length > 0 ? (
            <Panel className="overflow-hidden">
              <div className="hidden grid-cols-[44px_minmax(0,1fr)_92px_72px_108px] items-center gap-4 border-b hairline px-5 py-3 md:grid">
                <span className="label">Pos</span>
                <span className="label">Project</span>
                <span className="label text-right">Arenas</span>
                <span className="label text-right">Wins</span>
                <span className="label text-right">Rating</span>
              </div>
              {topRated.map((project, index) => (
                <Link
                  key={project.slug}
                  href={`/project/${project.slug}`}
                  className="group grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-b hairline px-4 py-4 transition-colors last:border-b-0 hover:bg-white/[0.025] sm:px-5 md:grid-cols-[44px_minmax(0,1fr)_92px_72px_108px] md:gap-4"
                >
                  <span className={cn('num text-sm', index === 0 ? 'text-gold' : 'text-bone-dim')}>
                    {formatRank(index + 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium tracking-tight text-bone transition-colors group-hover:text-arena">
                      {project.name}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-widest text-bone-faint">
                      {project.category}
                      <span className="md:hidden"> · {project.wins} wins</span>
                    </span>
                  </span>
                  <span className="hidden num text-right text-sm text-bone-dim md:block">
                    {project.appearances}
                  </span>
                  <span className="hidden num text-right text-sm text-bone-dim md:block">
                    {project.wins}
                  </span>
                  <span className="flex items-center justify-end gap-2">
                    <BarChart3 className="h-3.5 w-3.5 text-bone-faint md:hidden" aria-hidden />
                    <span className={cn('num text-sm', index === 0 ? 'text-gold' : 'text-bone')}>
                      {formatNumber(project.arenaRating)}
                    </span>
                  </span>
                </Link>
              ))}
            </Panel>
          ) : (
            <EmptyState title="No ratings yet" hint="The first completed Arena will set the table." />
          )}

          <Link
            href="/hall-of-fame"
            className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-bone-dim sm:hidden"
          >
            View Hall of Fame
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Container>
      </section>

      <section className="border-b hairline py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeader
            eyebrow="Registration open"
            title="Pick your next field."
            action={
              <Link
                href="/arenas"
                className="group hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-bone-dim transition-colors hover:text-bone sm:inline-flex"
              >
                All Arenas
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            }
          />

          {upcoming.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {upcoming.map((next, index) => (
                <Reveal key={next.slug} delay={index * 0.05} className="h-full">
                  <article className="group flex h-full min-h-[330px] flex-col border border-white/[0.08] bg-ink-900/50 p-5 transition-colors hover:border-white/[0.16] hover:bg-ink-900 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <span className="num text-sm text-bone-faint">ARENA {pad2(next.number)}</span>
                      <StatusBadge status={next.status} />
                    </div>

                    <div className="mt-7">
                      <Link
                        href={`/arena/${next.slug}`}
                        className="text-xl font-semibold tracking-tight text-bone transition-colors group-hover:text-arena"
                      >
                        {next.name}
                      </Link>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-bone-dim">
                        {next.theme}
                      </p>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4 border-y hairline py-4">
                      <div>
                        <Label>Field</Label>
                        <p className="mt-1.5 num text-sm text-bone">
                          {next.entrantCount}/{next.entrantCap}
                        </p>
                      </div>
                      <div>
                        <Label>Entry</Label>
                        <p className="mt-1.5 num text-sm text-bone">
                          {next.entryFeeCents === 0 ? 'Free' : formatMoney(next.entryFeeCents)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto pt-6">
                      <Label>Starts in</Label>
                      <Countdown target={next.startsAt} size="sm" showDays className="mt-3" />
                      <ButtonLink
                        href={`/enter?arena=${next.slug}`}
                        variant={index === 0 ? 'primary' : 'secondary'}
                        size="md"
                        className="mt-6 w-full"
                      >
                        Enter this Arena
                      </ButtonLink>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyState title="No Arenas scheduled" hint="The next slate is being drawn up." />
          )}

          <Link
            href="/arenas"
            className="mt-5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-bone-dim sm:hidden"
          >
            View all Arenas
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Container>
      </section>

      <section className="py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="relative overflow-hidden border border-arena/25 bg-[linear-gradient(120deg,rgba(255,75,31,0.12),rgba(11,13,15,0.9)_48%,rgba(47,224,138,0.04))] p-6 sm:p-10 lg:p-12">
            <div
              className="grid-lines pointer-events-none absolute inset-0 opacity-30 [mask-image:linear-gradient(to_right,black,transparent)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[44px] border-arena/[0.06]"
              aria-hidden
            />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Label className="text-arena">Your move</Label>
                <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-headline text-bone sm:text-5xl lg:text-6xl">
                  Stop launching into silence.
                  <span className="block text-bone-dim">Enter the field.</span>
                </h2>
                <p className="mt-5 max-w-xl text-sm leading-relaxed text-bone-dim sm:text-base">
                  Put your project where discovery, competition, and measurable momentum happen at
                  the same time.
                </p>
              </div>
              <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row lg:flex-col">
                <ButtonLink href="/enter" size="lg" className="group w-full sm:min-w-[220px]">
                  Enter your project
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </ButtonLink>
                <ButtonLink
                  href="/arenas"
                  variant="secondary"
                  size="lg"
                  className="w-full sm:min-w-[220px]"
                >
                  Browse Arenas
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
