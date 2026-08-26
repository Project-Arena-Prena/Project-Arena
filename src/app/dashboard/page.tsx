import type { Metadata } from 'next';
import Link from 'next/link';
import { LiveEntryCard } from '@/components/dashboard/live-entry-card';
import { NextArenaCard } from '@/components/dashboard/next-arena-card';
import { ProjectRow } from '@/components/dashboard/project-row';
import { SummaryBar } from '@/components/dashboard/summary-bar';
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
import { requireBuilder } from '@/lib/auth';
import { getBuilderDashboard } from '@/lib/builder-queries';

export const metadata: Metadata = {
  title: 'Builder Dashboard',
  description: 'Track your Projects, live Arena performance, and next opportunities.',
};

const ONBOARDING_STEPS = [
  ['01', 'Create', 'Add your Project, story, website, and logo.'],
  ['02', 'Enter', 'Choose an open Arena that fits your Project.'],
  ['03', 'Compete', 'Share your ranking and turn attention into visits.'],
] as const;

export default async function DashboardPage() {
  const ctx = await requireBuilder('/dashboard');
  const { projects, live, upcoming, entries } = await getBuilderDashboard(ctx.builder.id);

  const next = upcoming.find((arena) => arena.status === 'registration') ?? upcoming[0] ?? null;
  const pendingReviews = entries.filter((item) => item.entry.status === 'pending_review');
  const canEnter = projects.length > 0 && next?.status === 'registration';
  const liveRanks = new Map(live.map((item) => [item.project.id, item.standing.rank]));

  return (
    <>
      <section className="relative overflow-hidden border-b hairline bg-ink-900">
        <div className="absolute inset-y-0 left-0 w-1 bg-arena" aria-hidden />
        <div
          className="grid-lines pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-32 -top-40 h-80 w-80 rounded-full bg-arena/[0.07] blur-3xl"
          aria-hidden
        />
        <Container className="relative py-10 sm:py-12 lg:py-14">
          <Reveal className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Label className="text-arena">Builder command center</Label>
              <h1 className="mt-4 max-w-4xl text-[clamp(3.2rem,7vw,5.8rem)] font-semibold uppercase leading-[0.84] tracking-[-0.07em] text-bone">
                Your Builder dashboard
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-bone-dim sm:text-base">
                Track attention, manage your Projects, and make your next Arena move.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              {canEnter && next ? (
                <ButtonLink
                  href={`/enter?arena=${next.slug}`}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  Enter next Arena
                </ButtonLink>
              ) : null}
              <ButtonLink
                href="/dashboard/projects/new"
                variant={canEnter ? 'secondary' : 'primary'}
                size="lg"
                className="w-full sm:w-auto"
              >
                Create Project
              </ButtonLink>
            </div>
          </Reveal>
        </Container>
      </section>

      {projects.length === 0 ? (
        <Container className="py-12 sm:py-16">
          <Reveal>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <Panel className="overflow-hidden border-white/30">
                <div className="border-b hairline px-5 py-5 sm:px-7 sm:py-6">
                  <Label>Start here</Label>
                  <h2 className="mt-3 text-2xl font-semibold tracking-headline sm:text-3xl">
                    Put your first Project in play
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-bone-dim">
                    Create a Project profile once, then use it to enter future Arenas and build a
                    lasting Arena Rating.
                  </p>
                </div>
                <ol className="grid sm:grid-cols-3">
                  {ONBOARDING_STEPS.map(([number, title, copy], index) => (
                    <li
                      key={number}
                      className={`hairline px-5 py-5 sm:px-6 ${
                        index > 0 ? 'border-t sm:border-l sm:border-t-0' : ''
                      }`}
                    >
                      <span className="num text-sm text-arena">{number}</span>
                      <h3 className="mt-4 font-mono text-[11px] uppercase tracking-widest text-bone">
                        {title}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-bone-faint">{copy}</p>
                    </li>
                  ))}
                </ol>
                <div className="border-t hairline px-5 py-5 sm:px-7">
                  <ButtonLink href="/dashboard/projects/new" size="lg" className="w-full sm:w-auto">
                    Create your first Project
                  </ButtonLink>
                </div>
              </Panel>

              {next ? (
                <NextArenaCard arena={next} />
              ) : (
                <EmptyState
                  title="No Arenas open yet"
                  hint="Create your Project now so it is ready when entries open."
                />
              )}
            </div>
          </Reveal>
        </Container>
      ) : (
        <>
          <Container className="pb-16 pt-8 sm:pb-20 sm:pt-10">
            <Reveal delay={0.04}>
              <SummaryBar projects={projects} liveCount={live.length} />
            </Reveal>

            <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
              <div className="min-w-0">
                <Reveal delay={0.08}>
                  <SectionHeader
                    eyebrow="Competition"
                    title="Live performance"
                    action={
                      <Link
                        href="/arenas"
                        className="font-mono text-[10px] uppercase tracking-widest text-bone-faint transition-colors hover:text-bone"
                      >
                        All Arenas
                      </Link>
                    }
                  />
                  {live.length > 0 ? (
                    <div className="flex flex-col gap-5">
                      {live.map((item) => (
                        <LiveEntryCard
                          key={`${item.project.id}:${item.arena.id}`}
                          project={item.project}
                          arena={item.arena}
                          standing={item.standing}
                          movement={item.movement}
                        />
                      ))}
                    </div>
                  ) : (
                    <Panel className="flex flex-col gap-5 border-dashed px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-widest text-bone-dim">
                          No active entries
                        </p>
                        <p className="mt-2 max-w-md text-sm leading-relaxed text-bone-faint">
                          Your live rank, supporters, and Project visits will appear here when an
                          Arena starts.
                        </p>
                      </div>
                      {next?.status === 'registration' ? (
                        <ButtonLink
                          href={`/enter?arena=${next.slug}`}
                          variant="secondary"
                          size="sm"
                          className="w-full shrink-0 sm:w-auto"
                        >
                          Enter an Arena
                        </ButtonLink>
                      ) : null}
                    </Panel>
                  )}
                </Reveal>

                <Reveal delay={0.12} className="mt-12">
                  <SectionHeader
                    eyebrow="Roster"
                    title="Your Projects"
                    action={
                      <Link
                        href="/dashboard/projects"
                        className="font-mono text-[10px] uppercase tracking-widest text-bone-faint transition-colors hover:text-bone"
                      >
                        Manage all
                      </Link>
                    }
                  />
                  <Panel className="border-white/30">
                    {projects.map((project) => (
                      <ProjectRow
                        key={project.id}
                        project={project}
                        liveRank={liveRanks.get(project.id) ?? null}
                      />
                    ))}
                  </Panel>
                </Reveal>
              </div>

              <aside className="flex min-w-0 flex-col gap-10 lg:sticky lg:top-24">
                <Reveal delay={0.1}>
                  <SectionHeader eyebrow="Opportunity" title="Your next move" />
                  {next ? (
                    <NextArenaCard arena={next} />
                  ) : (
                    <EmptyState
                      title="No Arenas open yet"
                      hint="The next competition is being prepared."
                    />
                  )}
                </Reveal>

                {pendingReviews.length > 0 ? (
                  <Reveal delay={0.14}>
                    <SectionHeader eyebrow="Status" title="Pending review" />
                    <Panel className="border-white/30">
                      {pendingReviews.map((item) => (
                        <div
                          key={item.entry.id}
                          className="border-b hairline px-5 py-4 last:border-b-0"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-bone">
                              {item.arena.name}
                            </p>
                            <StatusBadge status="pending_review" />
                          </div>
                          <p className="mt-3 text-sm text-bone-dim">{item.project.name}</p>
                          <p className="mt-1 text-xs leading-relaxed text-bone-faint">
                            Payment confirmed. Your Project appears when approved.
                          </p>
                        </div>
                      ))}
                    </Panel>
                  </Reveal>
                ) : null}
              </aside>
            </div>
          </Container>

        </>
      )}
    </>
  );
}
