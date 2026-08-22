import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Label } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Arena } from '@/lib/types';

const GRID = 'lg:grid lg:grid-cols-[minmax(0,1fr)_150px_92px_104px] lg:items-center lg:gap-6';

export function CompletedTableHeader() {
  return (
    <div className={cn('hidden border-b hairline px-6 py-3', GRID)}>
      <Label>Arena</Label>
      <Label>Finished</Label>
      <Label>Field</Label>
      <Label>Result</Label>
    </div>
  );
}

export function CompletedArenaRow({ arena }: { arena: Arena }) {
  return (
    <Link
      href={`/arena/${arena.slug}`}
      className={cn(
        'group flex flex-col gap-4 border-b hairline px-5 py-5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.02] lg:px-6 lg:py-4',
        GRID,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm text-bone-dim transition-colors duration-200 group-hover:text-bone">
          {arena.name}
        </span>
        <span className="text-xs text-bone-faint lg:truncate">{arena.theme}</span>
      </div>

      <div className="grid grid-cols-2 gap-5 lg:contents">
        <div className="flex flex-col gap-2">
          <Label className="lg:hidden">Finished</Label>
          <span className="num text-xs text-bone-faint">{formatDate(arena.endsAt)}</span>
        </div>
        <div className="flex flex-col gap-2">
          <Label className="lg:hidden">Field</Label>
          <span className="num text-xs text-bone-faint">{formatNumber(arena.entrantCount)}</span>
        </div>
      </div>

      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-bone-faint transition-colors duration-200 group-hover:text-bone">
        Result
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
