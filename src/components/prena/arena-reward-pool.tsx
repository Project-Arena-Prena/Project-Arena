'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { ArenaRewardPool as Pool } from '@/services/rewards';
import { RewardBreakdown } from './reward-breakdown';

/**
 * Reward pool as competition information, in the same register as prize money
 * — not as a token product. No price, no fiat conversion, no yield.
 */
export function ArenaRewardPool({ pool, className }: { pool: Pool; className?: string }) {
  const [open, setOpen] = useState(false);
  const hasTiers = pool.tiers.length > 0;

  return (
    <div className={cn('border hairline bg-ink-900/60', className)}>
      <div className="flex items-end justify-between gap-6 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-2">
          <Label>Arena Reward Pool</Label>
          <div className="flex items-baseline gap-2">
            <span className="num text-3xl leading-none tracking-tight text-bone sm:text-4xl">
              {pool.totalAmountFormatted}
            </span>
            <span className="num text-sm text-bone-faint">${pool.tokenSymbol}</span>
          </div>
          <p className="text-xs text-bone-faint">Earned through Project Arena. Rank decides who receives it.</p>
        </div>
        {hasTiers ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-bone-dim hover:text-bone"
          >
            {open ? 'Hide' : 'Breakdown'}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        ) : null}
      </div>
      {open && hasTiers ? (
        <RewardBreakdown tiers={pool.tiers} poolTotal={pool.totalAmount} tokenSymbol={pool.tokenSymbol} />
      ) : null}
    </div>
  );
}
