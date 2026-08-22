import Link from 'next/link';
import { cn } from '@/lib/cn';
import { formatDate, formatNumber, formatRank } from '@/lib/format';
import type { ProjectHistoryEntry } from '@/lib/types';

export interface DashboardResult {
  projectSlug: string;
  projectName: string;
  entry: ProjectHistoryEntry;
}

const COLS = 'md:grid-cols-[1fr_1fr_110px_92px_88px]';

function deltaTone(delta: number): string {
  if (delta > 0) return 'text-gain';
  if (delta < 0) return 'text-arena';
  return 'text-bone-faint';
}

export function ResultsTable({ rows }: { rows: DashboardResult[] }) {
  return (
    <div className="w-full min-w-[320px]">
      <div className={cn('hidden gap-4 border-b hairline px-4 py-2.5 md:grid', COLS)}>
        <span className="label">Project</span>
        <span className="label">Arena</span>
        <span className="label">Finished</span>
        <span className="label text-right">Pos</span>
        <span className="label text-right">Rating</span>
      </div>

      {rows.map(({ projectSlug, projectName, entry }) => (
        <div
          key={`${projectSlug}:${entry.arenaSlug}`}
          className={cn(
            'relative grid grid-cols-[1fr_auto_auto] items-center gap-x-5 border-b hairline px-4 py-3.5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.025] md:gap-x-4',
            COLS,
            entry.rank === 1 && 'bg-gold/[0.045]',
          )}
        >
          {entry.rank === 1 ? (
            <span className="absolute inset-y-0 left-0 w-px bg-gold/70" aria-hidden />
          ) : null}

          <div className="flex min-w-0 flex-col gap-1">
            <Link
              href={`/project/${projectSlug}`}
              className="truncate text-[15px] font-medium tracking-tight text-bone transition-colors duration-200 hover:text-arena"
            >
              {projectName}
            </Link>
            <span className="num truncate text-[10px] uppercase tracking-widest text-bone-faint md:hidden">
              {entry.arenaName}
              <span className="mx-1.5 text-bone-faint/50">/</span>
              {formatDate(entry.endedAt)}
            </span>
          </div>

          <Link
            href={`/arena/${entry.arenaSlug}`}
            className="hidden truncate text-sm text-bone-dim transition-colors duration-200 hover:text-arena md:block"
          >
            {entry.arenaName}
          </Link>

          <span className="hidden num text-xs text-bone-faint md:block">
            {formatDate(entry.endedAt)}
          </span>

          <span
            className={cn(
              'num text-right text-sm',
              entry.rank === 1 ? 'text-gold' : entry.rank <= 3 ? 'text-bone' : 'text-bone-dim',
            )}
          >
            {formatRank(entry.rank)}
            <span className="text-bone-faint">/{entry.entrants}</span>
          </span>

          <span className={cn('num text-right text-sm', deltaTone(entry.ratingDelta))}>
            {entry.ratingDelta > 0 ? '+' : ''}
            {formatNumber(entry.ratingDelta)}
          </span>
        </div>
      ))}
    </div>
  );
}
