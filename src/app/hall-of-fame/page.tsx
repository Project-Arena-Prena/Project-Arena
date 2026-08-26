import type { Metadata } from 'next';
import Image from 'next/image';
import { ButtonLink, Container, EmptyState, Label, Panel, Rule, SectionHeader } from '@/components/ui';
import { ChampionRow } from '@/components/hall/champion-row';
import { RatingTable } from '@/components/hall/rating-table';
import { Reveal } from '@/components/reveal';
import { formatNumber } from '@/lib/format';
import { getHallOfFame, getTopRatedProjects } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Hall of Fame',
  description:
    'The permanent record. Every Arena produces exactly one Champion — plus the all-time Arena Rating board.',
};

export default async function HallOfFamePage() {
  const [results, topRated] = await Promise.all([getHallOfFame(), getTopRatedProjects(10)]);

  const roll = [...results].sort(
    (a, b) => new Date(b.arena.endsAt).getTime() - new Date(a.arena.endsAt).getTime(),
  );

  const uniqueChampions = new Set(roll.map((r) => r.champion.project.slug)).size;
  const largestField = roll.reduce((max, r) => Math.max(max, r.arena.entrantCount), 0);

  const meta = [
    { label: 'Arenas completed', value: formatNumber(roll.length) },
    { label: 'Champions', value: formatNumber(uniqueChampions) },
    { label: 'Largest field', value: formatNumber(largestField) },
  ];

  return (
    <>
      {/* -------------------------------------------------------------- header */}
      <section className="relative overflow-hidden border-b hairline bg-ink-900">
        <Image
          src="/art/roman-hall-of-fame.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="roman-art-drift pointer-events-none object-cover object-[68%_center] opacity-[0.7] saturate-[0.72] contrast-[1.08]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#080808_0%,rgba(8,8,8,0.94)_36%,rgba(8,8,8,0.46)_67%,rgba(8,8,8,0.3)_100%),linear-gradient(0deg,#080808_0%,transparent_58%)]"
          aria-hidden
        />
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-15 [mask-image:linear-gradient(to_right,black,transparent)]" aria-hidden />
        <div className="arena-noise pointer-events-none absolute inset-0 opacity-[0.045]" aria-hidden />
        <div className="absolute inset-y-0 left-0 w-1 bg-arena" aria-hidden />
        <Container className="relative py-16 sm:py-20 lg:py-24">
          <span className="absolute right-5 top-7 hidden font-mono text-[8px] uppercase tracking-[0.2em] text-white/45 sm:block sm:right-8">
            The permanent record · Gallery I
          </span>
          <Reveal>
            <Label>Hall of Fame</Label>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="mt-6 text-[clamp(4rem,10vw,7.5rem)] font-semibold uppercase leading-[0.82] tracking-[-0.075em]">
              Champions
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-bone-dim sm:text-base">
              Every Arena produces exactly one Champion. The record is permanent.
            </p>
          </Reveal>

          {roll.length > 0 ? (
            <Reveal delay={0.18}>
              <Rule className="mt-12" />
              <div className="flex flex-wrap gap-x-12 gap-y-6 pt-6">
                {meta.map((cell) => (
                  <div key={cell.label} className="flex flex-col gap-2">
                    <Label>{cell.label}</Label>
                    <span className="num text-xl leading-none text-bone">{cell.value}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          ) : null}
        </Container>
      </section>

      {/* ----------------------------------------------------- champions roll */}
      <section className="border-b hairline py-16 sm:py-20">
        <Container>
          <SectionHeader eyebrow="The record" title="Champions roll" />

          {roll.length > 0 ? (
            <Reveal delay={0.08}>
              <div className="border-y hairline">
                {roll.map((result, i) => (
                  <ChampionRow key={result.arena.slug} result={result} featured={i === 0} />
                ))}
              </div>
            </Reveal>
          ) : (
            <EmptyState
              title="No Champions yet"
              hint="The first Arena has not finished. The record starts with the next result."
            />
          )}
        </Container>
      </section>

      {/* ------------------------------------------------------- arena rating */}
      <section className="border-b hairline py-16 sm:py-20">
        <Container>
          <SectionHeader eyebrow="All time" title="Arena Rating" />
          <p className="max-w-xl pb-6 text-sm leading-relaxed text-bone-dim">
            Rating carries across every Arena a project enters. Wins move it most. Nothing resets.
          </p>
          {topRated.length > 0 ? (
            <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Panel className="border-white/30">
                <RatingTable projects={topRated} />
              </Panel>
              <figure className="relative min-h-[360px] overflow-hidden border border-white/20 bg-[#9b8261] lg:min-h-full">
                <Image
                  src="/art/roman-victory.webp"
                  alt="Classical victory statue beside a laurel wreath and Roman mosaic"
                  fill
                  sizes="(max-width: 1024px) 100vw, 320px"
                  className="object-cover object-[50%_35%] saturate-[0.7] contrast-[1.06] transition-transform duration-[1400ms] hover:scale-[1.025]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />
                <figcaption className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-4 border-t border-white/35 pt-3 font-mono text-[8px] uppercase tracking-[0.18em] text-white/70">
                  <span>Victory study</span>
                  <span>I · ∞</span>
                </figcaption>
              </figure>
            </div>
          ) : (
            <EmptyState title="No rated projects" hint="Ratings appear after the first Arena ends." />
          )}
        </Container>
      </section>

      {/* --------------------------------------------------------- closing cta */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="relative flex flex-col gap-6 overflow-hidden border border-white/30 bg-ink-900 p-6 md:flex-row md:items-center md:justify-between md:gap-10 sm:p-8">
            <Image
              src="/art/roman-hall-of-fame.webp"
              alt=""
              fill
              sizes="100vw"
              className="pointer-events-none object-cover object-[74%_center] opacity-[0.18] grayscale-[0.2]"
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/90 to-ink-900/40" aria-hidden />
            <span className="absolute inset-y-0 left-0 w-1 bg-arena" aria-hidden />
            <div className="relative flex flex-col gap-3">
              <Label>Open</Label>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-headline sm:text-4xl">
                The next name here has not entered yet.
              </h2>
            </div>
            <ButtonLink href="/enter" size="lg" className="relative w-full shrink-0 md:w-auto">
              Enter the Arena
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
