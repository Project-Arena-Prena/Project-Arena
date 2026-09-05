import Link from 'next/link';
import { ProjectLogo } from '@/components/project-logo';
import { formatNumber, formatRank } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Project } from '@/lib/types';

export function RatingTable({ projects }: { projects: Project[] }) {
  return (
    <div className="w-full">
      <div className="hidden grid-cols-[48px_minmax(0,1fr)_104px_72px_84px_128px] items-center gap-4 border-b hairline px-4 py-2.5 md:grid">
        <span className="label">Pos</span>
        <span className="label">Project</span>
        <span className="label text-right">Appearances</span>
        <span className="label text-right">Wins</span>
        <span className="label text-right">Podiums</span>
        <span className="label text-right">Arena Rating</span>
      </div>

      {projects.map((project, i) => {
        const pos = i + 1;
        return (
          <Link
            key={project.slug}
            href={`/project/${project.slug}`}
            className={cn(
              'relative grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-4 border-b hairline px-4 py-3.5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.025] md:grid-cols-[48px_minmax(0,1fr)_104px_72px_84px_128px]',
              pos === 1 && 'bg-gold/[0.045]',
            )}
          >
            {pos === 1 ? (
              <span className="absolute inset-y-0 left-0 w-px bg-gold/70" aria-hidden />
            ) : null}

            <span className={cn('num text-sm', pos === 1 ? 'text-gold' : 'text-bone-dim')}>
              {formatRank(pos)}
            </span>

            <div className="flex min-w-0 items-center gap-3">
              <ProjectLogo name={project.name} logoUrl={project.logoUrl} size="sm" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px] font-medium tracking-tight text-bone">
                  {project.name}
                </span>
                <span className="label truncate md:hidden">
                  {project.category} · {project.appearances} Arenas · {project.wins}W ·{' '}
                  {project.podiums}P
                </span>
                <span className="label hidden truncate md:block">{project.category}</span>
              </span>
            </div>

            <span className="hidden num text-right text-sm text-bone-dim md:block">
              {project.appearances}
            </span>
            <span
              className={cn(
                'hidden num text-right text-sm md:block',
                project.wins > 0 ? 'text-gold' : 'text-bone-faint',
              )}
            >
              {project.wins}
            </span>
            <span className="hidden num text-right text-sm text-bone-dim md:block">
              {project.podiums}
            </span>

            <span className="num text-right text-base text-bone md:text-lg">
              {formatNumber(project.arenaRating)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
