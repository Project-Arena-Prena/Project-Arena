import { Label } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { Project } from '@/lib/types';

interface Cell {
  label: string;
  value: string;
  tone: string;
  lead?: boolean;
  suffix?: string;
}

function tone(n: number): string {
  return n === 0 ? 'text-bone-faint' : 'text-bone';
}

export function CareerStats({
  project,
  lastDelta,
  percentile,
}: {
  project: Project;
  lastDelta?: number;
  percentile?: string | null;
}) {
  const delta =
    typeof lastDelta === 'number' && lastDelta !== 0
      ? `${lastDelta > 0 ? '▲ +' : '▼ '}${lastDelta} last Arena`
      : undefined;
  const cells: Cell[] = [
    {
      label: 'Arena Rating',
      value: formatNumber(project.arenaRating),
      tone: 'text-bone',
      lead: true,
      suffix: [percentile, delta].filter(Boolean).join(' · ') || undefined,
    },
    { label: 'Appearances', value: formatNumber(project.appearances), tone: tone(project.appearances) },
    { label: 'Wins', value: formatNumber(project.wins), tone: project.wins > 0 ? 'text-gold' : 'text-bone-faint' },
    { label: 'Podiums', value: formatNumber(project.podiums), tone: tone(project.podiums) },
    { label: 'Supporters', value: formatNumber(project.totalSupporters), tone: tone(project.totalSupporters) },
    { label: 'Project Visits', value: formatNumber(project.totalClicks), tone: tone(project.totalClicks) },
  ];

  return (
    <div className="overflow-hidden">
      <div className="-ml-px -mt-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className={cn(
              'flex min-h-[104px] flex-col justify-between gap-4 border-l border-t hairline px-4 py-5 sm:px-5',
              cell.lead && 'bg-white/[0.015]',
            )}
          >
            <Label className={cell.lead ? 'text-bone-dim' : undefined}>{cell.label}</Label>
            <span
              className={cn(
                'num leading-none tracking-tight',
                cell.lead ? 'text-[32px] sm:text-[38px]' : 'text-xl sm:text-2xl',
                cell.tone,
              )}
            >
              {cell.value}
            </span>
            {cell.suffix ? <span className="font-mono text-[9px] uppercase tracking-widest text-arena">{cell.suffix}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
