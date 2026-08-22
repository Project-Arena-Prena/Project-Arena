import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Label, Panel, buttonClass } from '@/components/ui';
import { formatNumber, formatRank } from '@/lib/format';
import type { Standing } from '@/lib/types';

export function ChampionPanel({ standing }: { standing: Standing }) {
  const { project } = standing;

  return (
    <Panel className="relative overflow-hidden border-gold/25 bg-gold/[0.035]">
      <span className="absolute inset-y-0 left-0 w-px bg-gold" aria-hidden />
      <div className="flex flex-col gap-8 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="flex min-w-0 gap-5 sm:gap-8">
          <div className="flex shrink-0 flex-col gap-2">
            <Label className="text-gold/70">Champion</Label>
            <span className="num text-[44px] leading-none tracking-tight text-gold sm:text-6xl">
              {formatRank(standing.rank)}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Link
              href={`/project/${project.slug}`}
              className="truncate text-3xl font-semibold tracking-headline text-bone transition-colors duration-200 hover:text-arena sm:text-4xl"
            >
              {project.name}
            </Link>
            <p className="max-w-md text-sm text-bone-dim">{project.tagline}</p>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1">
              <Label>{project.category}</Label>
              <span className="text-bone-faint/50">/</span>
              <Label>@{project.builder.handle}</Label>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-end gap-x-8 gap-y-5 sm:gap-x-10">
          <div className="flex flex-col gap-2">
            <Label>Supporters</Label>
            <span className="num text-xl leading-none text-bone">{formatNumber(standing.supporters)}</span>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Visits</Label>
            <span className="num text-xl leading-none text-bone">{formatNumber(standing.clicks)}</span>
          </div>
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={buttonClass('secondary', 'md')}
          >
            Visit Project
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </Panel>
  );
}
