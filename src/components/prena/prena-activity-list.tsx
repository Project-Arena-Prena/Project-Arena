'use client';

import Link from 'next/link';
import { EmptyState, Label, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { explorerTxUrl } from '@/lib/prena/config';
import type { PrenaActivityItem } from '@/services/activity';

const STATUS_TONE: Record<string, string> = {
  confirmed: 'text-live',
  claimed: 'text-live',
  claimable: 'text-gold',
  approved: 'text-bone-dim',
  pending: 'text-bone-dim',
  confirming: 'text-bone-dim',
  failed: 'text-arena',
  expired: 'text-arena',
  refunded: 'text-bone-faint',
};

const KIND_COPY: Record<PrenaActivityItem['kind'], string> = {
  entry: 'entry',
  reward: 'reward',
  claim: 'reward claim',
};

export function PrenaActivityList({
  items,
  emptyHint,
  className,
}: {
  items: PrenaActivityItem[];
  emptyHint?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No $PRENA activity yet"
        hint={emptyHint ?? 'Entries paid with $PRENA and rewards earned in Arenas appear here.'}
      />
    );
  }

  return (
    <Panel className={className}>
      {items.map((item) => {
        const explorer = explorerTxUrl(item.txHash);
        return (
          <div
            key={`${item.kind}:${item.id}`}
            className="flex flex-col gap-2 border-b hairline px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          >
            <div className="min-w-0">
              <p className="num text-[11px] text-bone-faint">
                {item.occurredAt ? formatDate(item.occurredAt) : '—'}
              </p>
              <p className="mt-1 truncate text-sm">
                {item.arenaSlug ? (
                  <Link href={`/arena/${item.arenaSlug}`} className="hover:text-arena">
                    {item.arenaName}
                  </Link>
                ) : (
                  item.arenaName
                )}{' '}
                <span className="text-bone-faint">{KIND_COPY[item.kind]}</span>
              </p>
              {item.projectName ? <p className="text-xs text-bone-faint">{item.projectName}</p> : null}
            </div>
            <div className="flex items-center gap-4 sm:justify-end">
              <span
                className={cn(
                  'num text-sm',
                  item.direction === 'credit' ? 'text-live' : 'text-bone',
                )}
              >
                {item.direction === 'credit' ? '+' : '−'}
                {item.amountFormatted} {item.tokenSymbol}
              </span>
              <span
                className={cn(
                  'font-mono text-[10px] uppercase tracking-widest',
                  STATUS_TONE[item.status] ?? 'text-bone-faint',
                )}
              >
                {item.status}
              </span>
              {explorer ? (
                <a
                  href={explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] uppercase tracking-widest text-bone-faint hover:text-bone"
                >
                  Tx
                </a>
              ) : null}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

export function PrenaActivityFilters({
  active,
  className,
}: {
  active: 'all' | 'entries' | 'rewards' | 'claims';
  className?: string;
}) {
  const options: Array<{ key: typeof active; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'entries', label: 'Entries' },
    { key: 'rewards', label: 'Rewards' },
    { key: 'claims', label: 'Claims' },
  ];
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Label className="mr-1">Filter</Label>
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.key === 'all' ? '/dashboard/prena' : `/dashboard/prena?filter=${option.key}`}
          className={cn(
            'h-8 border px-3 font-mono text-[10px] uppercase tracking-widest leading-8',
            active === option.key
              ? 'border-arena/50 bg-arena/[0.06] text-arena'
              : 'border-white/12 text-bone-faint hover:text-bone',
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
