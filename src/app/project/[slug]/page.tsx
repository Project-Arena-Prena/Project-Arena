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
import {
  getAllProjectSlugs,
  getLiveArena,
  getLiveStandingForProject,
  getProject,
  getProjectHistory,
} from '@/lib/queries';

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
  return {
    title: project.name,
    description: project.tagline,
    openGraph: {
      title: `${project.name} — Project Arena`,
      description: project.tagline,
      type: 'website',
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

  const [history, liveStanding, liveArena] = await Promise.all([
    getProjectHistory(slug),
    getLiveStandingForProject(slug),
    getLiveArena(),
  ]);

  const competing = liveStanding && liveArena ? { standing: liveStanding, arena: liveArena } : null;

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
      <section className="border-b hairline">
        <Container className="py-10 lg:py-14">
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

          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            <Reveal className="flex min-w-0 flex-col gap-4">
              <ProjectLogo name={project.name} logoUrl={project.logoUrl} size="lg" />
              <span className="inline-flex w-fit items-center border hairline px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-bone-dim">
                {project.category}
              </span>
              <h1 className="text-[42px] font-semibold leading-[0.9] tracking-headline sm:text-6xl lg:text-7xl">
                {project.name}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-bone-dim sm:text-base">
                {project.tagline}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                <span>Built by</span>
                <span className="text-bone-dim">@{project.builder.handle}</span>
                <span className="text-bone-faint/50">/</span>
                <span className="text-bone-dim">{project.builder.displayName}</span>
              </div>
            </Reveal>

            <Reveal delay={0.06} className="flex shrink-0 lg:justify-end">
              <ProjectActions
                projectSlug={project.slug}
                projectName={project.name}
                projectUrl={project.url}
                liveArenaSlug={competing ? competing.arena.slug : null}
                initialSupporters={competing ? competing.standing.supporters : 0}
              />
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="border-b hairline">
        <Container>
          <CareerStats project={project} />
        </Container>
      </section>

      {competing ? (
        <Container className="pt-10 sm:pt-12">
          <ShareResultCard standing={competing.standing} arena={competing.arena} />
        </Container>
      ) : null}

      <Container className="pt-10 sm:pt-12">
        <Reveal delay={0.1} className="flex flex-col gap-10 lg:flex-row lg:gap-16">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Label>About</Label>
            <p className="max-w-[62ch] text-sm leading-relaxed text-bone-dim sm:text-[15px]">
              {project.description}
            </p>
          </div>

          <dl className="w-full shrink-0 border-t hairline lg:w-[300px]">
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
        <Panel className="mt-12 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex min-w-0 flex-col gap-2">
            <Label>Next Arena</Label>
            <p className="text-lg font-semibold tracking-headline sm:text-xl">
              Enter this Project in the next Arena
            </p>
            <p className="text-xs text-bone-dim">Grids close when they fill.</p>
          </div>
          <ButtonLink href="/enter" size="lg" className="w-full sm:w-auto">
            Enter Arena
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
