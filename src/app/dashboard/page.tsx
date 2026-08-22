import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountStrip } from '@/components/dashboard/account-strip';
import { ProjectRow } from '@/components/dashboard/project-row';
import { Reveal } from '@/components/reveal';
import { ResultsTable, type DashboardResult } from '@/components/dashboard/results-table';
import { SummaryBar } from '@/components/dashboard/summary-bar';
import { Countdown } from '@/components/countdown';
import { Leaderboard } from '@/components/leaderboard';
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
import { formatNumber, formatRank } from '@/lib/format';
import {
  getBuilderProjects,
  getLiveArena,
  getLiveStandingForProject,
  getProjectHistory,
  getStandings,
} from '@/lib/queries';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Builder Dashboard',
  description: 'Your Projects, your live position, and your Arena record.',
};

const RESULT_LIMIT = 10;

export default async function DashboardPage() {
  const [user, projects, liveArena] = await Promise.all([
    getSessionUser(),
    getBuilderProjects(),
    getLiveArena(),
  ]);

  const [histories, liveStandings, arenaStandings] = await Promise.all([
    Promise.all(projects.map((p) => getProjectHistory(p.slug))),
    Promise.all(projects.map((p) => getLiveStandingForProject(p.slug))),
    liveArena ? getStandings(liveArena.slug) : Promise.resolve([]),
  ]);

  const ranks = new Map(
    projects.flatMap((p, i) => {
      const standing = liveStandings[i];
      return standing ? [[p.slug, standing.rank] as const] : [];
    }),
  );

  const bestSlug = [...ranks.entries()].sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;
  const bestIndex = bestSlug ? arenaStandings.findIndex((s) => s.project.slug === bestSlug) : -1;
  const livePanel =
    liveArena && bestIndex >= 0
      ? {
          arena: liveArena,
          standing: arenaStandings[bestIndex],
          entrants: arenaStandings.length,
          window: arenaStandings.slice(Math.max(0, bestIndex - 2), bestIndex + 3),
        }
      : null;

  const results: DashboardResult[] = projects
    .flatMap((p, i) =>
      histories[i].map((entry) => ({ projectSlug: p.slug, projectName: p.name, entry })),
    )
    .sort((a, b) => Date.parse(b.entry.endedAt) - Date.parse(a.entry.endedAt))
    .slice(0, RESULT_LIMIT);

  return (
    <div className="pb-20">
      <AccountStrip email={user?.email ?? null} />

      <section className="border-b hairline">
        <Container className="py-10 lg:py-12">
          <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
            <div className="flex min-w-0 flex-col gap-3">
              <Label>Builder Dashboard</Label>
              <h1 className="text-[42px] font-semibold leading-[0.9] tracking-headline sm:text-5xl lg:text-6xl">
                Your projects
              </h1>
            </div>
            <ButtonLink href="/enter" size="lg" className="w-full shrink-0 sm:w-auto">
              Enter a Project
            </ButtonLink>
          </Reveal>
        </Container>
      </section>

      {projects.length === 0 ? (
        <Container className="pt-12 sm:pt-16">
          <Reveal className="flex flex-col items-center gap-6">
            <div className="w-full">
              <EmptyState
                title="No projects yet"
                hint="Enter a Project in an Arena and your record, standings, and results appear here."
              />
            </div>
            <ButtonLink href="/enter" size="lg">
              Enter a Project
            </ButtonLink>
          </Reveal>
        </Container>
      ) : (
        <>
          <Container className="pt-10 sm:pt-12">
            <Reveal delay={0.04}>
              <SummaryBar projects={projects} />
            </Reveal>
          </Container>

          {livePanel ? (
            <Container className="pt-12 sm:pt-16">
              <Reveal delay={0.08}>
                <SectionHeader eyebrow="Now" title="Live position" />
                <Panel>
                  <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge status="live" />
                        <Link
                          href={`/arena/${livePanel.arena.slug}`}
                          className="text-xl font-semibold tracking-headline transition-colors duration-200 hover:text-arena"
                        >
                          {livePanel.arena.name}
                        </Link>
                      </div>
                      <p className="num text-sm text-bone-dim">
                        You are P{formatRank(livePanel.standing.rank)} of{' '}
                        {formatNumber(livePanel.entrants)}.
                        <span className="mx-2 text-bone-faint/50">/</span>
                        <span className="text-bone-faint">{livePanel.standing.project.name}</span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 lg:items-end">
                      <Label>Closes In</Label>
                      <Countdown target={livePanel.arena.endsAt} size="md" />
                    </div>
                  </div>

                  <Rule />

                  <Leaderboard
                    standings={livePanel.window}
                    arenaSlug={livePanel.arena.slug}
                    compact
                    interactive={false}
                  />
                </Panel>
              </Reveal>
            </Container>
          ) : null}

          <Container className="pt-12 sm:pt-16">
            <Reveal delay={0.12}>
              <SectionHeader
                eyebrow="Roster"
                title="Projects"
                action={
                  <span className="num hidden text-xs text-bone-faint sm:block">
                    {formatNumber(projects.length)} entered
                  </span>
                }
              />
              <Panel>
                {projects.map((project) => (
                  <ProjectRow
                    key={project.slug}
                    project={project}
                    liveRank={ranks.get(project.slug) ?? null}
                  />
                ))}
              </Panel>
            </Reveal>
          </Container>

          <Container className="pt-12 sm:pt-16">
            <Reveal delay={0.16}>
              <SectionHeader
                eyebrow="Record"
                title="Recent results"
                action={
                  results.length > 0 ? (
                    <span className="num hidden text-xs text-bone-faint sm:block">
                      Last {formatNumber(results.length)}
                    </span>
                  ) : null
                }
              />
              {results.length > 0 ? (
                <Panel>
                  <div className="overflow-x-auto">
                    <ResultsTable rows={results} />
                  </div>
                </Panel>
              ) : (
                <EmptyState
                  title="No completed Arenas yet"
                  hint="Results appear here the moment one of your Projects finishes an Arena."
                />
              )}
            </Reveal>
          </Container>
        </>
      )}
    </div>
  );
}
