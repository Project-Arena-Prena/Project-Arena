import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { CareerStats } from '@/components/project/career-stats';
import { HistoryTable } from '@/components/project/history-table';
import { ProjectActions } from '@/components/project/project-actions';
import { ProjectLogo } from '@/components/project-logo';
import { Reveal } from '@/components/reveal';
import { ShareResultCard } from '@/components/share-result-card';
import {
  ButtonLink,
  Container,
  EmptyState,
  Label,
  LiveDot,
  Panel,
  SectionHeader,
} from '@/components/ui';
import { formatDate, formatNumber, formatRank } from '@/lib/format';
import { percentileLabel } from '@/lib/scoring';
import {
  getAllProjectSlugs,
  getLiveArena,
  getLiveStandingForProject,
  getNextArenaForCategory,
  getProject,
  getProjectHistory,
} from '@/lib/queries';
import { shareImageUrl } from '@/lib/share';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getAllProjectSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return { title: 'Project Not Found' };
  const live = await getLiveStandingForProject(slug);
  const liveArena = await getLiveArena();
  return {
    title: project.name,
    description: project.tagline,
    openGraph: {
      title: `${project.name} — Project Arena`,
      description: project.tagline,
      type: 'website',
      images:
        live && liveArena ? [shareImageUrl('live', project.slug, liveArena.slug)] : undefined,
    },
  };
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  const [history, liveStanding, liveArena, nextArena] = await Promise.all([
    getProjectHistory(slug),
    getLiveStandingForProject(slug),
    getLiveArena(),
    getNextArenaForCategory(project.category),
  ]);

  const competing = liveStanding && liveArena ? { standing: liveStanding, arena: liveArena } : null;
  const last = history[0];
  const lastDelta = last?.ratingDelta ?? 0;
  const ratingPercent = project.appearances > 0 ? percentileLabel(Math.max(1, project.highestRank ?? 8), 32) : null;

  const meta: Array<{ label: string; value: ReactNode }> = [
    { label: 'Category', value: project.category },
    {
      label: 'Address',
      value: (
        <a
          href={`/go/${project.slug}`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1.5 text-bone-dim transition-colors duration-200 hover:text-arena"
        >
          {hostname(project.url)}
          <ArrowUpRight className="h-3 w-3" />
        </a>
      ),
    },
    { label: 'First Seen', value: formatDate(project.createdAt) },
    { label: 'Builder', value: `@${project.builder.handle}` },
    ...(project.xUrl
      ? [{ label: 'X', value: <a className="text-bone-dim transition-colors hover:text-arena" href={project.xUrl} target="_blank" rel="noopener noreferrer">Profile ↗</a> }]
      : []),
    ...(project.githubUrl
      ? [{ label: 'GitHub', value: <a className="text-bone-dim transition-colors hover:text-arena" href={project.githubUrl} target="_blank" rel="noopener noreferrer">Repository ↗</a> }]
      : []),
  ];

  return (
    <div className="pb-20">
      <section className="relative overflow-hidden border-b hairline bg-ink-900">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-25 [mask-image:linear-gradient(to_right,black,transparent_78%)]" aria-hidden />
        <div className="absolute inset-y-0 left-0 w-1 bg-arena" aria-hidden />
        <Container className="relative py-12 lg:py-20">
          {competing ? (
            <Reveal className="pb-6">
              <Link
                href={`/arena/${competing.arena.slug}`}
                className="inline-flex items-center gap-2.5 border border-live/25 bg-live/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-live transition-colors duration-200 hover:border-live/50"
              >
                <LiveDot />
                Competing Now
                <span className="text-live/30">/</span>
                <span className="text-bone-dim">{competing.arena.name}</span>
                <span className="text-live/30">/</span>
                <span className="num">P{formatRank(competing.standing.rank)}</span>
              </Link>
            </Reveal>
          ) : null}

          <div className="flex flex-col gap-9 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            <Reveal className="flex min-w-0 items-start gap-5 sm:gap-7">
              <ProjectLogo name={project.name} logoUrl={project.logoUrl} size="lg" />
              <div className="min-w-0">
                <span className="inline-flex w-fit items-center border border-white/30 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-bone-dim">
                  {project.category}
                </span>
                <h1 className="mt-4 text-[clamp(3.5rem,9vw,7rem)] font-semibold uppercase leading-[0.82] tracking-[-0.075em]">
                  {project.name}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-bone-dim sm:text-lg">
                  {project.tagline}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-bone-faint">
                  <span>Built by</span>
                  <span className="text-bone-dim">@{project.builder.handle}</span>
                  <span className="text-bone-faint/50">/</span>
                  <span className="text-bone-dim">{project.builder.displayName}</span>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.06} className="flex shrink-0 lg:justify-end">
              <ProjectActions
                projectSlug={project.slug}
                projectName={project.name}
                liveArenaSlug={competing ? competing.arena.slug : null}
                initialSupporters={competing ? competing.standing.supporters : 0}
              />
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="border-b hairline">
        <Container>
          <CareerStats project={project} lastDelta={lastDelta} percentile={ratingPercent} />
        </Container>
      </section>

      {competing ? (
        <Container className="pt-10 sm:pt-12">
          <ShareResultCard standing={competing.standing} arena={competing.arena} />
        </Container>
      ) : null}

      <Container className="pt-10 sm:pt-12">
        <Reveal delay={0.1} className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-20">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Label>About</Label>
            <h2 className="max-w-3xl text-3xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-5xl">
              {project.tagline}
            </h2>
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-bone-dim sm:text-base">
              {project.description}
            </p>
          </div>

          <dl className="w-full shrink-0 border-t border-white/30">
            {meta.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 border-b hairline py-3"
              >
                <dt className="label">{row.label}</dt>
                <dd className="num text-xs text-bone-dim">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Container>

      <Container className="pt-12 sm:pt-16">
        <Reveal delay={0.14}>
          <SectionHeader
            eyebrow="Record"
            title="Competitive history"
            action={
              history.length > 0 ? (
                <span className="num hidden text-xs text-bone-faint sm:block">
                  {formatNumber(history.length)} completed
                </span>
              ) : null
            }
          />
          {history.length > 0 ? (
            <Panel>
              <div className="overflow-x-auto">
                <HistoryTable entries={history} />
              </div>
            </Panel>
          ) : (
            <EmptyState
              title="No completed Arenas yet"
              hint="Results appear here the moment this Project finishes its first Arena."
            />
          )}
        </Reveal>
      </Container>

      <Container>
        <Panel className="relative mt-12 flex flex-col gap-5 overflow-hidden border-white/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <span className="absolute inset-y-0 left-0 w-1 bg-arena" aria-hidden />
          <div className="flex min-w-0 flex-col gap-2">
            <Label>Next Arena</Label>
            <p className="text-lg font-semibold tracking-headline sm:text-xl">
              {nextArena ? `Next for ${project.name}: ${nextArena.name}` : 'Enter this Project in the next Arena'}
            </p>
            <p className="text-xs text-bone-dim">
              {nextArena
                ? `${nextArena.entrantCount} / ${nextArena.entrantCap} spots filled`
                : 'Grids close when they fill.'}
            </p>
          </div>
          <ButtonLink href={nextArena ? `/enter?arena=${nextArena.slug}` : '/enter'} size="lg" className="w-full sm:w-auto">
            Enter next Arena
          </ButtonLink>
        </Panel>

        <div className="mt-6 flex flex-col gap-4 border-t hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/arenas"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-bone-faint transition-colors duration-200 hover:text-bone"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Arenas
          </Link>
          {competing ? (
            <Link
              href={`/arena/${competing.arena.slug}`}
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-bone-dim transition-colors duration-200 hover:text-bone"
            >
              <LiveDot />
              {competing.arena.name}
            </Link>
          ) : (
            <Link
              href="/hall-of-fame"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-bone-dim transition-colors duration-200 hover:text-bone"
            >
              Hall of Fame
            </Link>
          )}
        </div>
      </Container>
    </div>
  );
}
