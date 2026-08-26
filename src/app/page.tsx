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
import { RomanArtInterlude } from '@/components/home/roman-art-interlude';
import { RomanHeroBackdrop } from '@/components/home/roman-hero-backdrop';
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
  title: { absolute: 'Project Arena — Where projects compete for attention' },
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
      <section className="relative flex min-h-svh items-end overflow-hidden border-b hairline bg-black py-28 sm:min-h-[860px] sm:py-32">
        <RomanHeroBackdrop />

        <div className="absolute right-5 top-24 z-10 hidden items-center gap-3 font-mono text-[8px] uppercase tracking-[0.2em] text-white/45 sm:flex lg:right-8">
          <span>Field I</span>
          <span className="h-px w-12 bg-white/30" aria-hidden />
          <span>Public competition</span>
        </div>

        <Container className="relative z-10 pb-16 sm:pb-20">
          <Reveal>
            <div className="mb-6 flex items-center gap-4 sm:mb-8">
              <Image
                src="/project-arena-logo.png"
                alt="Project Arena"
                width={1536}
                height={1024}
                sizes="(min-width: 640px) 144px, 120px"
                className="h-20 w-auto object-contain brightness-0 invert sm:h-24"
              />
              <span className="h-px w-12 bg-white/40" aria-hidden />
            </div>
          </Reveal>

          <Reveal delay={0.04}>
            <h1 className="max-w-[1040px] text-[clamp(3.2rem,10vw,8.1rem)] font-bold uppercase leading-[0.82] tracking-[-0.075em] text-bone">
              <span className="block">The internet</span>
              <span className="block">is building.</span>
              <span className="block text-arena">See what&apos;s winning.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="mt-7 max-w-xl text-sm leading-relaxed text-bone sm:mt-8 sm:text-[17px]">
              Discover projects competing for attention, support the ones you believe in, or enter
              your own.
            </p>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink
                href={arena ? `/arena/${arena.slug}` : '/arenas'}
                size="lg"
                className="group w-full sm:w-auto"
              >
                <Radio className="h-4 w-4" /> Watch live
              </ButtonLink>
              <ButtonLink
                href="/enter"
                variant="secondary"
                size="lg"
                className="group w-full border-white/60 bg-black/30 sm:w-auto"
              >
                Enter the Arena
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </ButtonLink>
            </div>
          </Reveal>
        </Container>

        <Container className="absolute inset-x-0 bottom-5 z-10 sm:bottom-6">
          <div className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-y border-white/25 py-2 font-mono text-[8px] uppercase tracking-[0.14em] text-white/70 sm:grid-cols-[1fr_1fr_auto] sm:px-4 sm:text-[9px]">
            <span className="inline-flex items-center gap-2">
              <LiveDot /> Gate open · {arena?.name ?? 'Next Arena'}
            </span>
            <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
              {arena ? `${arena.entrantCount} projects · 48 hours · one champion` : 'Registration is open'}
            </span>
            <Link
              href={arena ? `/arena/${arena.slug}` : '/arenas'}
              className="col-start-2 row-start-1 inline-flex items-center gap-2 font-bold text-bone sm:col-start-auto"
            >
              <span className="hidden sm:inline">Enter race control</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Container>
      </section>

      <section className="border-b hairline py-20 sm:py-28 lg:py-32">
        <Container>
          <Reveal className="flex flex-col gap-9 sm:flex-row sm:items-end sm:justify-between sm:gap-16">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-arena">
                <LiveDot /> Live now
              </div>
              <h2 className="mt-4 text-[clamp(3.4rem,8vw,6.2rem)] font-semibold uppercase leading-[0.85] tracking-[-0.07em]">
                {arena ? arena.name : 'The next Arena'}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-bone-dim sm:text-base">
                {arena?.theme ?? 'The next competitive field is forming now.'}
              </p>
            </div>
            {arena ? (
              <div className="min-w-0 border-t hairline pt-5 sm:min-w-[330px] sm:border-l sm:border-t-0 sm:pb-2 sm:pl-8 sm:pt-0">
                <Label>Ends in</Label>
                <Countdown target={arena.endsAt} size="lg" className="mt-4" />
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

      <section className="border-b hairline bg-ink-900 py-20 sm:py-28 lg:py-32">
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
                <Reveal key={step.number} delay={index * 0.05} className="h-full">
                  <article
                    className={cn(
                      'group flex min-h-[280px] flex-col p-6 transition-[transform,background-color] hover:-translate-y-1 hover:bg-[#110602] sm:p-8',
                      index > 0 && 'border-t hairline md:border-l md:border-t-0',
                    )}
                  >
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
            Entry buys a place in the competition—not a higher rank. The field decides what wins.
          </p>
        </Container>
      </section>

      <section className="border-b hairline py-20 sm:py-28">
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

      <section className="relative overflow-hidden border-b hairline py-24 text-center sm:py-36">
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
