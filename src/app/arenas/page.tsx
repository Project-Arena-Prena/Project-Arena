import type { Metadata } from 'next';
import Link from 'next/link';
import { CompletedArenaRow, CompletedTableHeader } from '@/components/arenas/completed-arena-row';
import { LiveArenaPanel } from '@/components/arenas/live-arena-panel';
import { Reveal } from '@/components/reveal';
import { UpcomingArenaRow, UpcomingTableHeader } from '@/components/arenas/upcoming-arena-row';
import { Container, EmptyState, Label, LiveDot, Panel, SectionHeader } from '@/components/ui';
import { pad2 } from '@/lib/format';
import { getArenas, getStandings } from '@/lib/queries';
import { cn } from '@/lib/cn';

export const metadata: Metadata = {
  title: 'Arenas',
  description:
    'The full Arena schedule. What is live, what opens next, and every Arena already decided.',
};

function SectionCount({ n }: { n: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="num text-xl leading-none text-bone-faint sm:text-2xl">{pad2(n)}</span>
      <Label>{n === 1 ? 'Arena' : 'Arenas'}</Label>
    </div>
  );
}

export default async function ArenasPage() {
  const { live, upcoming, past } = await getArenas();
  const podiums = await Promise.all(live.map((arena) => getStandings(arena.slug, 3)));

  const jump = [
    { href: '#live', label: 'Live now', n: live.length, dot: true },
    { href: '#upcoming', label: 'Upcoming', n: upcoming.length, dot: false },
    { href: '#completed', label: 'Completed', n: past.length, dot: false },
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b hairline">
        <div
          className="grid-lines pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.8),transparent_85%)]"
          aria-hidden
        />
        <Container className="relative py-16 sm:py-20 lg:py-24">
          <Reveal>
            <Label>Arenas</Label>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="mt-6 text-5xl font-semibold tracking-headline sm:text-6xl lg:text-[72px] lg:leading-[1.02]">
              The schedule
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-6 max-w-xl text-sm text-bone-dim sm:text-base">
              One Arena at a time. Enter before the clock starts.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-12 grid grid-cols-3 border hairline">
              {jump.map((cell, i) => (
                <Link
                  key={cell.href}
                  href={cell.href}
                  className={cn(
                    'flex flex-col gap-3 px-4 py-4 transition-colors duration-200 hover:bg-white/[0.025] sm:px-5 sm:py-5',
                    i > 0 && 'border-l hairline',
                  )}
                >
                  <span className="flex items-center gap-2">
                    {cell.dot ? <LiveDot /> : null}
                    <Label className={cell.dot ? 'text-live' : undefined}>{cell.label}</Label>
                  </span>
                  <span className="num text-2xl leading-none text-bone sm:text-[28px]">
                    {pad2(cell.n)}
                  </span>
                </Link>
              ))}
            </div>
          </Reveal>
        </Container>
      </section>

      <section id="live" className="scroll-mt-20 border-b hairline py-14 sm:py-16">
        <Container>
          <Reveal>
            <SectionHeader title="Live now" action={<SectionCount n={live.length} />} />
          </Reveal>
          {live.length === 0 ? (
            <EmptyState
              title="No Arena on the clock"
              hint="The next Arena is already taking entries. Get in before it starts."
            />
          ) : (
            <div className="flex flex-col gap-6">
              {live.map((arena, i) => (
                <Reveal key={arena.slug} delay={0.06 + i * 0.06}>
                  <LiveArenaPanel arena={arena} podium={podiums[i]} />
                </Reveal>
              ))}
            </div>
          )}
        </Container>
      </section>

      <section id="upcoming" className="scroll-mt-20 border-b hairline py-14 sm:py-16">
        <Container>
          <Reveal>
            <SectionHeader title="Upcoming" action={<SectionCount n={upcoming.length} />} />
          </Reveal>
          {upcoming.length === 0 ? (
            <EmptyState
              title="No Arena scheduled"
              hint="The next slate is being set. Check back shortly."
            />
          ) : (
            <Reveal delay={0.06}>
              <Panel>
                <UpcomingTableHeader />
                {upcoming.map((arena) => (
                  <UpcomingArenaRow key={arena.slug} arena={arena} />
                ))}
              </Panel>
            </Reveal>
          )}
        </Container>
      </section>

      <section id="completed" className="scroll-mt-20 py-14 sm:py-16">
        <Container>
          <Reveal>
            <SectionHeader
              title="Completed"
              action={<SectionCount n={past.length} />}
            />
          </Reveal>
          {past.length === 0 ? (
            <EmptyState title="No results yet" hint="Finished Arenas are archived here." />
          ) : (
            <Reveal delay={0.06}>
              <Panel>
                <CompletedTableHeader />
                {past.map((arena) => (
                  <CompletedArenaRow key={arena.slug} arena={arena} />
                ))}
              </Panel>
            </Reveal>
          )}
        </Container>
      </section>
    </>
  );
}
