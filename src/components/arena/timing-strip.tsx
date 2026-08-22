import { Label } from '@/components/ui';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import type { Arena } from '@/lib/types';

interface Cell {
  label: string;
  value: string;
  suffix?: string;
}

export function TimingStrip({ arena }: { arena: Arena }) {
  const cells: Cell[] = [
    { label: 'Projects', value: formatNumber(arena.entrantCount), suffix: `/ ${arena.entrantCap}` },
    { label: 'Spectators', value: formatNumber(arena.spectators) },
    { label: 'Project Visits', value: formatNumber(arena.visits) },
    { label: 'Entry', value: arena.entryFeeCents === 0 ? 'FREE' : formatMoney(arena.entryFeeCents) },
    { label: 'Opened', value: formatDate(arena.startsAt) },
    { label: 'Closes', value: formatDate(arena.endsAt) },
  ];

  return (
    <div className="overflow-hidden">
      <div className="-ml-px -mt-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {cells.map((cell) => (
          <div key={cell.label} className="flex flex-col gap-2 border-l border-t hairline px-4 py-4 sm:px-5">
            <Label>{cell.label}</Label>
            <span className="num text-[15px] leading-none tracking-tight text-bone sm:text-base">
              {cell.value}
              {cell.suffix ? <span className="ml-1.5 text-bone-faint">{cell.suffix}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
