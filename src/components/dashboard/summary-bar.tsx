import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { Project } from '@/lib/types';

export function SummaryBar({ projects }: { projects: Project[] }) {
  const appearances = projects.reduce((n, p) => n + p.appearances, 0);
  const wins = projects.reduce((n, p) => n + p.wins, 0);
  const supporters = projects.reduce((n, p) => n + p.totalSupporters, 0);

  const cells = [
    { label: 'Projects', value: formatNumber(projects.length), gold: false },
    { label: 'Arenas Entered', value: formatNumber(appearances), gold: false },
    { label: 'Wins', value: formatNumber(wins), gold: wins > 0 },
    { label: 'Total Supporters', value: formatNumber(supporters), gold: false },
  ];

  return (
    <div className="grid grid-cols-2 border hairline sm:grid-cols-4">
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={cn(
            'flex flex-col gap-2.5 px-5 py-6 sm:px-6',
            'hairline',
            i % 2 === 1 && 'border-l',
            i >= 2 && 'border-t sm:border-t-0',
            i > 0 && 'sm:border-l',
          )}
        >
          <span className="label">{cell.label}</span>
          <span
            className={cn(
              'num text-[26px] leading-none tracking-tight sm:text-3xl',
              cell.gold ? 'text-gold' : 'text-bone',
            )}
          >
            {cell.value}
          </span>
        </div>
      ))}
    </div>
  );
}
