import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { ProjectLogo } from '@/components/project-logo';
import { ButtonLink, Label, LiveDot, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatNumber, formatRank } from '@/lib/format';
import { shareText, xIntentUrl } from '@/lib/share';
import { siteUrl } from '@/lib/stripe';
import type { Arena, Project, Standing } from '@/lib/types';

export function LiveEntryCard({
  project,
  arena,
  standing,
  movement,
}: {
  project: Project;
  arena: Arena;
  standing: Standing;
  movement: number;
}) {
  const url = `${siteUrl()}/arena/${arena.slug}`;
  const text = shareText('live', {
    projectName: project.name,
    arenaName: arena.name,
    rank: standing.rank,
    url,
  });
  const movementLabel =
    movement > 0
      ? `Up ${movement} ${movement === 1 ? 'position' : 'positions'}`
      : movement < 0
        ? `Down ${Math.abs(movement)} ${movement === -1 ? 'position' : 'positions'}`
        : 'Holding position';

  return (
    <Panel className="group relative overflow-hidden transition-colors duration-300 hover:border-white/[0.14]">
      <span className="absolute inset-x-0 top-0 h-px bg-live/70" aria-hidden />
      <div className="flex flex-col gap-4 border-b hairline px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <ProjectLogo name={project.name} logoUrl={project.logoUrl} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-live">
                <LiveDot />
                Competing live
              </span>
            </div>
            <h3 className="mt-1 truncate text-lg font-semibold tracking-tight text-bone">
              {project.name}
            </h3>
            <Link
              href={`/arena/${arena.slug}`}
              className="mt-0.5 block truncate text-xs text-bone-faint transition-colors hover:text-arena"
            >
              {arena.name}
            </Link>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1 sm:items-end">
          <Label>Ends in</Label>
          <Countdown target={arena.endsAt} size="sm" showDays />
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4">
        <div className="relative col-span-3 border-b hairline px-4 py-5 sm:col-span-1 sm:border-b-0 sm:px-5">
          <Label>Current rank</Label>
          <div className="mt-2 flex items-end gap-3">
            <span className="num text-4xl leading-none tracking-tight text-bone sm:text-5xl">
              #{formatRank(standing.rank)}
            </span>
            <span
              className={cn(
                'mb-1 font-mono text-[9px] uppercase tracking-widest sm:text-[10px]',
                movement > 0
                  ? 'text-gain'
                  : movement < 0
                    ? 'text-arena'
                    : 'text-bone-faint',
              )}
            >
              {movement > 0 ? '↑ ' : movement < 0 ? '↓ ' : ''}
              {movementLabel}
            </span>
          </div>
        </div>
        <Metric label="Points" value={standing.score} className="sm:border-l" />
        <Metric label="Supporters" value={standing.supporters} border />
        <Metric label="Project visits" value={standing.clicks} border />
      </div>

      <div className="flex flex-col gap-3 border-t hairline px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <ButtonLink href={`/arena/${arena.slug}`} size="sm" className="w-full sm:w-auto">
          View live Arena
        </ButtonLink>
        <ButtonLink
          href={`/dashboard/projects/${project.id}/arenas/${arena.id}`}
          variant="secondary"
          size="sm"
          className="w-full sm:w-auto"
        >
          View performance
        </ButtonLink>
        <a
          href={xIntentUrl(text)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center justify-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-widest text-bone-faint transition-colors hover:text-bone sm:ml-auto"
        >
          Share ranking
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </Panel>
  );
}

function Metric({
  label,
  value,
  border,
  className,
}: {
  label: string;
  value: number;
  border?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('hairline px-4 py-5 sm:px-5', border && 'border-l', className)}>
      <Label>{label}</Label>
      <p className="num mt-2 truncate text-xl leading-none tracking-tight text-bone sm:text-2xl">
        {formatNumber(value)}
      </p>
    </div>
  );
}
