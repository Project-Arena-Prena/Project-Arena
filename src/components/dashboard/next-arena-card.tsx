import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { ButtonLink, Label, Panel, StatusBadge } from '@/components/ui';
import { formatMoney, formatNumber } from '@/lib/format';
import type { Arena } from '@/lib/types';

export function NextArenaCard({ arena }: { arena: Arena }) {
  const fill = Math.min(100, Math.max(0, (arena.entrantCount / Math.max(1, arena.entrantCap)) * 100));
  const registrationOpen = arena.status === 'registration';

  return (
    <Panel className="relative overflow-hidden">
      <span className="absolute inset-x-0 top-0 h-px bg-arena/70" aria-hidden />
      <div className="border-b hairline px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <Label>Next opportunity</Label>
          <StatusBadge status={arena.status} />
        </div>
        <h3 className="mt-4 text-xl font-semibold tracking-headline text-bone sm:text-2xl">
          {arena.name}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-bone-faint">{arena.category}</p>
      </div>

      <div className="px-5 py-5">
        <Label>Starts in</Label>
        <div className="mt-3">
          <Countdown target={arena.startsAt} size="sm" showDays />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-5">
          <div>
            <Label>Entry</Label>
            <p className="num mt-2 text-lg leading-none text-bone">
              {arena.entryFeeCents === 0 ? 'Free' : formatMoney(arena.entryFeeCents)}
            </p>
          </div>
          <div>
            <Label>Spots filled</Label>
            <p className="num mt-2 text-lg leading-none text-bone">
              {formatNumber(arena.entrantCount)}
              <span className="text-bone-faint">/{formatNumber(arena.entrantCap)}</span>
            </p>
          </div>
        </div>

        <div className="mt-5 h-1 overflow-hidden bg-white/[0.06]" aria-hidden>
          <div className="h-full bg-arena transition-[width] duration-700" style={{ width: `${fill}%` }} />
        </div>

        <ButtonLink
          href={registrationOpen ? `/enter?arena=${arena.slug}` : `/arena/${arena.slug}`}
          size="md"
          className="mt-6 w-full"
        >
          {registrationOpen ? 'Enter this Arena' : 'View Arena'}
        </ButtonLink>
        <Link
          href={`/arena/${arena.slug}`}
          className="mt-4 flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-bone-faint transition-colors hover:text-bone"
        >
          Arena details
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </Panel>
  );
}
