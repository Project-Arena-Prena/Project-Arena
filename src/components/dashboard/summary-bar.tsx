import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { Project } from '@/lib/types';

export function SummaryBar({
  projects,
  liveCount,
}: {
  projects: Project[];
  liveCount: number;
}) {
  const supporters = projects.reduce((n, p) => n + p.totalSupporters, 0);
  const visits = projects.reduce((n, p) => n + p.totalClicks, 0);

  const cells = [
    { label: 'Projects', value: formatNumber(projects.length), tone: 'text-bone' },
    {
      label: 'Live now',
      value: formatNumber(liveCount),
      tone: liveCount > 0 ? 'text-live' : 'text-bone',
    },
    { label: 'Supporters earned', value: formatNumber(supporters), tone: 'text-bone' },
    { label: 'Project visits', value: formatNumber(visits), tone: 'text-bone' },
  ];

  return (
    <div className="grid grid-cols-2 overflow-hidden border hairline bg-ink-900/60 sm:grid-cols-4">
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={cn(
            'group relative flex min-w-0 flex-col gap-2.5 px-4 py-5 transition-colors duration-300 hover:bg-white/[0.025] sm:px-6 sm:py-6',
            'hairline',
            i % 2 === 1 && 'border-l',
            i >= 2 && 'border-t sm:border-t-0',
            i > 0 && 'sm:border-l',
          )}
        >
          {i === 1 && liveCount > 0 ? (
            <span className="absolute inset-x-0 top-0 h-px bg-live/60" aria-hidden />
          ) : null}
          <span className="label">{cell.label}</span>
          <span
            className={cn(
              'num truncate text-[26px] leading-none tracking-tight transition-transform duration-300 group-hover:translate-x-0.5 sm:text-3xl',
              cell.tone,
            )}
          >
            {cell.value}
          </span>
        </div>
      ))}
    </div>
  );
}
