import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  Flag,
  MousePointerClick,
  Radio,
  Trophy,
  Users,
} from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { Leaderboard } from '@/components/leaderboard';
import { Reveal } from '@/components/reveal';
import { CinematicHomeHero } from '@/components/home/cinematic-home-hero';
import { RomanArtInterlude } from '@/components/home/roman-art-interlude';
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
import { cn } from '@/lib/cn';
import { formatCompact, formatMoney, formatNumber, pad2 } from '@/lib/format';
import { getArenas, getLiveArena, getStandings } from '@/lib/queries';

export const metadata: Metadata = {
  title: { absolute: 'Project Arena | Where projects compete for attention' },
  description:
    'Discover projects competing for attention, support the ones you believe in, or enter your own.',
};

const STEPS = [
  {
    number: '01',
    icon: Flag,
    title: 'Enter',
    body: 'Choose an Arena and put your Project on the starting grid.',
  },
  {
    number: '02',
    icon: Radio,
    title: 'Compete live',
    body: 'Earn support and qualified visits while the classification moves.',
  },
  {
    number: '03',
    icon: Trophy,
    title: 'Build reputation',
    body: 'Keep every result, rating change, and championship on your profile.',
  },
];

export default async function HomePage() {
  const [arena, { upcoming }] = await Promise.all([getLiveArena(), getArenas()]);
  const allStandings = arena ? await getStandings(arena.slug) : [];
  const standings = allStandings.slice(0, 5);
  const supporterCount = allStandings.reduce((total, row) => total + row.supporters, 0);

  const stats = arena
    ? [
        { icon: Flag, label: 'Projects', value: formatNumber(arena.entrantCount) },
        { icon: Users, label: 'Supporters', value: formatCompact(supporterCount) },
        { icon: MousePointerClick, label: 'Project visits', value: formatCompact(arena.visits) },
        { icon: Eye, label: 'Spectators', value: formatCompact(arena.spectators) },
      ]
    : [];

  const ticker = arena
    ? [
        `LIVE: ${arena.name.toUpperCase()}`,
        standings[0] ? `P1: ${standings[0].project.name.toUpperCase()}` : 'THE GRID IS FORMING',
        `${formatNumber(supporterCount)} SUPPORTERS`,
        `${formatNumber(arena.visits)} PROJECT VISITS`,
        `${arena.entrantCount} PROJECTS COMPETING`,
      ]
    : ['REGISTRATION OPEN', 'THE NEXT GRID IS FORMING', 'RANK IS EARNED', 'DISCOVER. COMPETE. GET SEEN.'];

  return (
    <>
      <CinematicHomeHero
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
        standings={standings.map((standing) => ({
          rank: standing.rank,
          slug: standing.project.slug,
          name: standing.project.name,
          category: standing.project.category,
          logoUrl: standing.project.logoUrl,
          score: standing.score,
          share: standing.share,
          momentum: standing.momentum,
        }))}
      />

      <section className="arena-section relative overflow-hidden border-b hairline py-20 sm:py-28 lg:py-32">
        <Image
          src="/art/roman-arena-field.webp"
          alt=""
          fill
          sizes="100vw"
          className="pointer-events-none object-cover object-[74%_center] opacity-[0.075] saturate-[0.55]"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/95 to-ink-950/65" aria-hidden />
        <Container className="relative">
          <Reveal className="flex flex-col gap-9 sm:flex-row sm:items-end sm:justify-between sm:gap-16">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-arena">
                <LiveDot /> {arena ? 'Live now' : 'Next gate'}
              </div>
              <h2 className="mt-4 text-[clamp(3.4rem,8vw,6.2rem)] font-semibold uppercase leading-[0.85] tracking-[-0.07em]">
                {arena ? arena.name : upcoming[0]?.name ?? 'The next Arena'}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-bone-dim sm:text-base">
                {arena?.theme ?? upcoming[0]?.theme ?? 'The next competitive field is forming now.'}
              </p>
            </div>
            {arena || upcoming[0] ? (
              <div className="min-w-0 border-t hairline pt-5 sm:min-w-[330px] sm:border-l sm:border-t-0 sm:pb-2 sm:pl-8 sm:pt-0">
                <Label>{arena ? 'Ends in' : 'Starts in'}</Label>
                <Countdown target={arena?.endsAt ?? upcoming[0].startsAt} size="lg" showDays={!arena} className="mt-4" />
              </div>
            ) : null}
          </Reveal>

          {arena ? (
            <>
              <Reveal delay={0.04}>
                <div className="mt-10 grid grid-cols-2 border-y border-white/35 lg:grid-cols-4">
                  {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <div
                        key={stat.label}
                        className={cn(
                          'flex min-h-[92px] items-center gap-3 px-4 py-5 text-bone-faint sm:px-5',
                          index % 2 === 1 && 'border-l hairline',
                          index >= 2 && 'border-t hairline lg:border-t-0',
                          index > 0 && 'lg:border-l lg:hairline',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="flex min-w-0 flex-col gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-bone-dim">
                          {stat.label}
                          <strong className="num text-xl font-medium tracking-tight text-bone sm:text-2xl">
                            {stat.value}
                          </strong>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <Panel className="mt-9 overflow-hidden border-white/30">
                  <div className="flex items-center justify-between border-b hairline px-4 py-3">
                    <Label>Top five · Live classification</Label>
                    <span className="inline-flex items-center gap-2">
                      <LiveDot />
                      <Label className="text-arena">Updating</Label>
                    </span>
                  </div>
                  <Leaderboard standings={standings} arenaSlug={arena.slug} live compact />
                  <Link
                    href={`/arena/${arena.slug}`}
                    className="group flex min-h-16 items-center justify-center gap-2 border-t hairline font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-bone-dim transition-colors hover:bg-white/[0.03] hover:text-bone"
                  >
                    Full standings
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Panel>
              </Reveal>
            </>
          ) : upcoming[0] ? (
            <Reveal delay={0.08} direction="scale">
              <Panel className="group relative mt-10 overflow-hidden border-white/25 bg-ink-900/70 p-6 sm:p-8">
                <div className="grid-lines pointer-events-none absolute inset-0 opacity-25" aria-hidden />
                <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-arena shadow-[0_0_28px_rgba(232,80,2,0.32)]" aria-hidden />
                <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <Label>Registration is open</Label>
                    <p className="mt-5 text-2xl font-semibold tracking-tight text-bone sm:text-4xl">
                      {upcoming[0].entrantCount} projects have taken the field.{' '}
                      <span className="text-bone-dim">
                        {Math.max(0, upcoming[0].entrantCap - upcoming[0].entrantCount)} places remain.
                      </span>
                    </p>
                    <div className="mt-7 h-px overflow-hidden bg-white/10">
                      <span
                        className="block h-full bg-gradient-to-r from-arena to-gold transition-[width] duration-1000"
                        style={{ width: `${Math.min(100, (upcoming[0].entrantCount / upcoming[0].entrantCap) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <ButtonLink href={`/enter?arena=${upcoming[0].slug}`} size="lg" className="w-full shrink-0 lg:w-auto">
                    Take a place <ArrowRight className="h-4 w-4" />
                  </ButtonLink>
                </div>
              </Panel>
            </Reveal>
          ) : (
            <EmptyState title="No live Arena" hint="Browse the upcoming calendar and take a place on the next grid." />
          )}
        </Container>
      </section>

      <div className="overflow-hidden border-b hairline bg-ink-900" aria-label="Live platform metrics">
        <div className="flex min-w-max animate-ticker items-center motion-reduce:animate-none">
          {[...ticker, ...ticker].map((item, index) => (
            <span
              key={`${item}-${index}`}
              className={cn(
                'min-w-[280px] border-r hairline px-8 py-3 font-mono text-[9px] uppercase tracking-[0.13em] text-bone-dim',
                index % ticker.length === 0 && 'text-arena',
              )}
            >
              {index % ticker.length === 0 ? <LiveDot className="mr-2" /> : null}
              {item}
            </span>
          ))}
        </div>
      </div>

      <RomanArtInterlude />

      <section className="arena-section border-b hairline bg-ink-900/80 py-20 sm:py-28 lg:py-32">
        <Container>
          <Reveal>
            <Label>How it works</Label>
            <h2 className="mt-4 text-[clamp(2.8rem,6vw,4.5rem)] font-semibold leading-[0.94] tracking-[-0.06em]">
              Built like an event.
              <br />
              Not a directory.
            </h2>
          </Reveal>

          <div className="mt-12 grid border hairline md:grid-cols-3">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <Reveal
                  key={step.number}
                  delay={index * 0.055}
                  direction={index === 0 ? 'left' : index === 2 ? 'right' : 'up'}
                  className="h-full"
                >
                  <article
                    className={cn(
                      'group relative flex min-h-[300px] flex-col overflow-hidden p-6 transition-[transform,background-color,border-color] duration-500 hover:-translate-y-1.5 hover:bg-[#130b07] sm:p-8',
                      index > 0 && 'border-t hairline md:border-l md:border-t-0',
                    )}
                  >
                    <span className="pointer-events-none absolute -right-3 -top-8 font-display text-[9rem] font-semibold leading-none text-white/[0.018] transition-colors duration-500 group-hover:text-arena/[0.045]" aria-hidden>
                      {step.number}
                    </span>
                    <span className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-arena to-transparent transition-transform duration-700 group-hover:scale-x-100" aria-hidden />
                    <div className="flex items-center justify-between font-mono text-bone-faint transition-colors group-hover:text-arena">
                      <span>{step.number}</span>
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="mt-auto pt-16">
                      <h3 className="text-2xl font-semibold tracking-tight">{step.title}</h3>
                      <p className="mt-3 max-w-sm text-sm leading-relaxed text-bone-dim">{step.body}</p>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
          <p className="mt-5 border-l-2 border-arena pl-4 text-xs leading-relaxed text-bone-dim">
            Entry buys a place in the competition, not a higher rank. The field decides what wins.
          </p>
        </Container>
      </section>

      <section className="arena-section border-b hairline py-20 sm:py-28">
        <Container>
          <SectionHeader
            eyebrow="Registration open"
            title="Pick your next field."
            action={
              <Link
                href="/arenas"
                className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-dim transition-colors hover:text-bone sm:inline-flex"
              >
                Full calendar <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />

          {upcoming.length > 0 ? (
            <div className="grid border hairline lg:grid-cols-3">
              {upcoming.slice(0, 3).map((next, index) => (
                <Reveal key={next.slug} delay={index * 0.04} className="h-full">
                  <article
                    className={cn(
                      'group flex h-full min-h-[330px] flex-col p-6 transition-colors hover:bg-ink-900 sm:p-7',
                      index > 0 && 'border-t hairline lg:border-l lg:border-t-0',
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="num text-lg text-bone-faint">{pad2(next.number)}</span>
                      <StatusBadge status={next.status} />
                    </div>
                    <div className="mt-8">
                      <Link
                        href={`/arena/${next.slug}`}
                        className="text-2xl font-semibold uppercase leading-none tracking-[-0.04em] transition-colors group-hover:text-arena"
                      >
                        {next.name}
                      </Link>
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-bone-dim">
                        {next.theme}
                      </p>
                    </div>
                    <div className="mt-7 grid grid-cols-2 border-y hairline py-4">
                      <div>
                        <Label>Grid</Label>
                        <p className="mt-2 num text-sm">{next.entrantCount} / {next.entrantCap}</p>
                      </div>
                      <div className="border-l hairline pl-5">
                        <Label>Entry</Label>
                        <p className="mt-2 num text-sm">
                          {next.entryFeeCents === 0 ? 'Free' : formatMoney(next.entryFeeCents)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto pt-7">
                      <Label>Starts in</Label>
                      <Countdown target={next.startsAt} size="sm" showDays className="mt-3" />
                      <ButtonLink href={`/enter?arena=${next.slug}`} className="mt-6 w-full">
                        Enter Arena
                      </ButtonLink>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyState title="No Arenas scheduled" hint="The next slate is being drawn up." />
          )}
        </Container>
      </section>

      <section className="arena-section relative overflow-hidden border-b hairline py-24 text-center sm:py-36">
        <Image
          src="/art/roman-victory.webp"
          alt=""
          fill
          sizes="100vw"
          className="pointer-events-none object-cover object-[52%_34%] opacity-[0.2] grayscale-[0.25] saturate-[0.5]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.38),#000_78%)]"
          aria-hidden
        />
        <div className="arena-noise pointer-events-none absolute inset-0 opacity-[0.045]" aria-hidden />
        <Container className="relative">
          <Reveal>
            <Label className="text-arena">
              {upcoming[0]
                ? `${upcoming[0].entrantCount} / ${upcoming[0].entrantCap} spots filled · ${upcoming[0].name}`
                : 'The next grid is forming'}
            </Label>
            <h2 className="mt-5 text-[clamp(3.5rem,8vw,7rem)] font-semibold leading-[0.84] tracking-[-0.075em]">
              Don&apos;t just launch.
              <br />
              <span className="text-arena">Compete.</span>
            </h2>
            <p className="mx-auto mt-7 max-w-xl text-sm leading-relaxed text-bone-dim sm:text-base">
              Put your Project in front of people looking for something worth discovering.
            </p>
            <ButtonLink href="/enter" size="lg" className="mt-8 group">
              {upcoming[0]?.entryFeeCents
                ? `Enter for ${formatMoney(upcoming[0].entryFeeCents)}`
                : 'Enter the Arena'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
