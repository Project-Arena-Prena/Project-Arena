import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { ButtonLink, Label, Panel, StatusBadge } from '@/components/ui';
import { formatMoney, formatNumber, formatRank, pad2 } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Arena, Standing } from '@/lib/types';

export function LiveArenaPanel({ arena, podium }: { arena: Arena; podium: Standing[] }) {
  const cells = [
    { label: 'Projects', value: formatNumber(arena.entrantCount), sub: `Cap ${arena.entrantCap}` },
    { label: 'Spectators', value: formatNumber(arena.spectators), sub: 'This Arena' },
    { label: 'Visits', value: formatNumber(arena.visits), sub: 'Outbound' },
  ];

  return (
    <Panel className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden bg-live/20" aria-hidden>
        <span className="block h-px w-1/4 bg-live animate-sweep" />
      </div>

      <div className="flex flex-col gap-7 border-b hairline px-5 py-6 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status="live" />
            <Label>Arena {pad2(arena.number)}</Label>
          </div>
          <h3 className="text-2xl font-semibold tracking-headline sm:text-3xl">{arena.name}</h3>
          <p className="max-w-xl text-sm text-bone-dim">{arena.theme}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 lg:items-end">
          <Label>Ends in</Label>
          <Countdown target={arena.endsAt} size="md" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={cn(
              'flex items-baseline justify-between gap-4 px-5 py-4 sm:flex-col sm:items-start sm:justify-start sm:gap-2 sm:px-6 sm:py-5',
              i > 0 && 'border-t hairline sm:border-l sm:border-t-0',
            )}
          >
            <Label>{cell.label}</Label>
            <div className="flex items-baseline gap-2 sm:flex-col sm:items-start">
              <span className="num text-xl leading-none text-bone sm:text-[26px]">{cell.value}</span>
              <span className="label hidden sm:block">{cell.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t hairline px-5 py-3 sm:px-6">
        <Label>Podium</Label>
        <Label>Supporters</Label>
      </div>

      {podium.map((s) => (
        <Link
          key={s.project.slug}
          href={`/project/${s.project.slug}`}
          className={cn(
            'group grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-4 border-t hairline px-5 py-3 transition-colors duration-200 hover:bg-white/[0.025] sm:px-6',
            s.rank === 1 && 'bg-gold/[0.045]',
          )}
        >
          <span className={cn('num text-sm', s.rank === 1 ? 'text-gold' : 'text-bone-faint')}>
            {formatRank(s.rank)}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm text-bone">{s.project.name}</span>
            <span className="truncate text-xs text-bone-faint">{s.project.tagline}</span>
          </span>
          <span className="flex items-center gap-3">
            <span className="num text-xs text-bone-dim">{formatNumber(s.supporters)}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-bone-faint transition-colors duration-200 group-hover:text-bone" />
          </span>
        </Link>
      ))}

      <div className="flex flex-col gap-5 border-t hairline px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <Label>Champion takes</Label>
          <p className="max-w-lg text-xs text-bone-dim">{arena.prize}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-2">
            <Label>Entry</Label>
            <span className="num text-sm text-bone">
              {arena.entryFeeCents === 0 ? 'Free' : formatMoney(arena.entryFeeCents)}
            </span>
          </div>
          <ButtonLink href={`/arena/${arena.slug}`} size="md" className="flex-1 lg:flex-none">
            Watch Live
          </ButtonLink>
        </div>
      </div>
    </Panel>
  );
}
