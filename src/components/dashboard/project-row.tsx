import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { LiveDot } from '@/components/ui';
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
    <div className="group relative flex flex-col gap-5 border-b hairline px-5 py-5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.025] lg:flex-row lg:items-center lg:justify-between lg:gap-10">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/project/${project.slug}`}
            className="text-lg font-medium tracking-tight text-bone transition-colors duration-200 after:absolute after:inset-0 after:content-[''] hover:text-arena"
          >
            {project.name}
          </Link>
          <span className="border hairline px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-bone-faint">
            {project.category}
          </span>
          {liveRank !== null ? (
            <span className="inline-flex items-center gap-1.5 border border-live/25 bg-live/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-live">
              <LiveDot />
              P{formatRank(liveRank)}
            </span>
          ) : null}
        </div>
        <p className="max-w-[56ch] truncate text-sm text-bone-dim">{project.tagline}</p>
      </div>

      <div className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-center lg:gap-10">
        <div className="grid grid-cols-4 gap-5 lg:grid-cols-[104px_96px_60px_104px] lg:gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1.5 lg:items-end">
              <span className="label">{stat.label}</span>
              <span
                className={cn('num text-base leading-none', stat.gold ? 'text-gold' : 'text-bone')}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        <Link
          href="/enter"
          className="relative z-10 inline-flex w-fit items-center gap-1.5 border hairline px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-bone-faint transition-colors duration-200 hover:border-white/25 hover:text-bone"
        >
          Enter Next Arena
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
