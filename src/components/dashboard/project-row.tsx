import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { LiveDot } from '@/components/ui';
import { ProjectLogo } from '@/components/project-logo';
import { cn } from '@/lib/cn';
import { formatNumber, formatRank } from '@/lib/format';
import type { Project } from '@/lib/types';

export function ProjectRow({ project, liveRank }: { project: Project; liveRank: number | null }) {
  const stats = [
    { label: 'Arena Rating', value: formatNumber(project.arenaRating), gold: false },
    { label: 'Appearances', value: formatNumber(project.appearances), gold: false },
    { label: 'Wins', value: formatNumber(project.wins), gold: project.wins > 0 },
    { label: 'Supporters', value: formatNumber(project.totalSupporters), gold: false },
  ];

  return (
    <article className="group border-b hairline px-4 py-5 transition-colors duration-300 last:border-b-0 hover:bg-white/[0.025] sm:px-5">
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <ProjectLogo name={project.name} logoUrl={project.logoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/projects/${project.id}`}
              className="truncate text-base font-medium tracking-tight text-bone transition-colors duration-200 hover:text-arena sm:text-lg"
            >
              {project.name}
            </Link>
            {liveRank !== null ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 border border-live/25 bg-live/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-live sm:text-[10px]">
                <LiveDot />
                #{formatRank(liveRank)} live
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-bone-faint sm:text-sm">{project.tagline}</p>
          <span className="mt-2 inline-block border hairline px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-bone-faint">
            {project.category}
          </span>
        </div>
      </div>

      <div className="mt-5 border-t hairline pt-4 sm:ml-16">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex min-w-0 flex-col gap-1.5">
              <span className="label">{stat.label}</span>
              <span
                className={cn(
                  'num truncate text-base leading-none',
                  stat.gold ? 'text-gold' : 'text-bone',
                )}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-t hairline pt-4">
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="font-mono text-[10px] uppercase tracking-widest text-arena transition-colors duration-200 hover:text-bone"
          >
            Manage Project
          </Link>
          <Link
            href={`/project/${project.slug}`}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-bone-faint transition-colors duration-200 hover:text-bone"
          >
            Public profile
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
