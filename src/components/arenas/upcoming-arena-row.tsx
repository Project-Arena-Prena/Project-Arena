import Link from 'next/link';
import { Countdown } from '@/components/countdown';
import { Label, buttonClass } from '@/components/ui';
import { formatMoney, pad2 } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Arena } from '@/lib/types';

const GRID = 'lg:grid lg:grid-cols-[minmax(0,1fr)_150px_92px_280px_104px] lg:items-center lg:gap-6';

export function UpcomingTableHeader() {
  return (
    <div className={cn('hidden border-b hairline px-6 py-3', GRID)}>
      <Label>Arena</Label>
      <Label>Entrants</Label>
      <Label>Entry</Label>
      <Label>Starts in</Label>
      <span className="sr-only">Action</span>
    </div>
  );
}

export function UpcomingArenaRow({ arena }: { arena: Arena }) {
  const fill = arena.entrantCap > 0
    ? Math.min(100, Math.round((arena.entrantCount / arena.entrantCap) * 100))
    : 0;

  return (
    <div
      className={cn(
        'flex flex-col gap-5 border-b hairline px-5 py-6 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.02] lg:px-6 lg:py-5',
        GRID,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label>Arena {pad2(arena.number)}</Label>
        <h3 className="truncate text-lg font-semibold tracking-headline text-bone">{arena.name}</h3>
        <p className="text-xs text-bone-faint lg:truncate">{arena.theme}</p>
      </div>

      <div className="grid grid-cols-2 gap-5 lg:contents">
        <div className="flex flex-col gap-2">
          <Label className="lg:hidden">Entrants</Label>
          <span className="num text-sm leading-none text-bone">
            {arena.entrantCount}
            <span className="text-bone-faint">/{arena.entrantCap}</span>
          </span>
          <span className="block h-[3px] w-full bg-white/[0.07]" aria-hidden>
            <span className="block h-full bg-bone-dim" style={{ width: `${fill}%` }} />
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="lg:hidden">Entry</Label>
          <span className="num text-sm leading-none text-bone">
            {arena.entryFeeCents === 0 ? 'Free' : formatMoney(arena.entryFeeCents)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="lg:hidden">Starts in</Label>
        <Countdown target={arena.startsAt} size="sm" showDays />
      </div>

      {arena.status === 'full' || arena.entrantCount >= arena.entrantCap ? (
        <Link href="/arenas" className={cn(buttonClass('secondary', 'sm'), 'w-full lg:w-auto')}>
          Arena full
        </Link>
      ) : (
        <Link
          href={`/enter?arena=${arena.slug}`}
          className={cn(buttonClass('secondary', 'sm'), 'w-full lg:w-auto')}
        >
          Enter
        </Link>
      )}
    </div>
  );
}
