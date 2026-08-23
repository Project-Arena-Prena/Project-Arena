import Link from 'next/link';
import { cn } from '@/lib/cn';
import { formatCompact, formatDate, formatNumber, formatRank } from '@/lib/format';
import type { ProjectHistoryEntry } from '@/lib/types';

const COLS = 'md:grid-cols-[1fr_120px_92px_112px_112px_100px]';

function deltaTone(delta: number): string {
  if (delta > 0) return 'text-gain';
  if (delta < 0) return 'text-arena';
  return 'text-bone-faint';
}

function deltaLabel(delta: number): string {
  return `${delta > 0 ? '+' : ''}${formatNumber(delta)}`;
}

export function HistoryTable({ entries }: { entries: ProjectHistoryEntry[] }) {
  return (
    <div className="w-full min-w-[320px]">
      <div className={cn('hidden gap-4 border-b hairline px-4 py-2.5 md:grid', COLS)}>
        <span className="label">Arena</span>
        <span className="label">Finished</span>
        <span className="label text-right">Pos</span>
        <span className="label text-right">Supporters</span>
        <span className="label text-right">Visits</span>
        <span className="label text-right">Rating</span>
      </div>

      {entries.map((entry) => (
        <div
          key={entry.arenaSlug}
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
              href={`/arena/${entry.arenaSlug}`}
              className="truncate text-[15px] font-medium tracking-tight text-bone transition-colors duration-200 hover:text-arena"
            >
              {entry.rank === 1 ? '🏆 Champion · ' : ''}
            {entry.arenaName}
            </Link>
            <span className="num text-[10px] uppercase tracking-widest text-bone-faint md:hidden">
              {formatDate(entry.endedAt)}
              <span className="mx-1.5 text-bone-faint/50">/</span>
              {formatCompact(entry.supporters)} Supporters
              <span className="mx-1.5 text-bone-faint/50">/</span>
              {formatCompact(entry.clicks)} Visits
            </span>
          </div>

          <span className="hidden num text-xs text-bone-faint md:block">{formatDate(entry.endedAt)}</span>

          <span
            className={cn(
              'num text-right text-sm',
              entry.rank === 1 ? 'text-gold' : entry.rank <= 3 ? 'text-bone' : 'text-bone-dim',
            )}
          >
            {formatRank(entry.rank)}
            <span className="text-bone-faint">/{entry.entrants}</span>
          </span>

          <span className="hidden num text-right text-sm text-bone-dim md:block">
            {formatNumber(entry.supporters)}
          </span>
          <span className="hidden num text-right text-sm text-bone-dim md:block">
            {formatNumber(entry.clicks)}
          </span>

          <span className={cn('num text-right text-sm', deltaTone(entry.ratingDelta))}>
            {deltaLabel(entry.ratingDelta)}
          </span>
        </div>
      ))}
    </div>
  );
}
