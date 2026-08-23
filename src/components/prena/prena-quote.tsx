'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui';
import { cn } from '@/lib/cn';
import { countdownFrom, pad2 } from '@/lib/format';

export interface QuoteData {
  id: string;
  usdAmount: number;
  discountPercent: number;
  discountedUsdAmount: number;
  tokenAmount: string;
  tokenAmountFormatted: string;
  tokenSymbol: string;
  tokenContract: string | null;
  tokenDecimals: number;
  chainId: number;
  expiresAt: string;
  mode: 'mock' | 'onchain';
}

/** Shows the live quote and how long it stays spendable. */
export function PrenaQuote({
  quote,
  onExpired,
  className,
}: {
  quote: QuoteData;
  onExpired?: () => void;
  className?: string;
}) {
  const [remaining, setRemaining] = useState(() => countdownFrom(quote.expiresAt).total);

  useEffect(() => {
    setRemaining(countdownFrom(quote.expiresAt).total);
    const timer = window.setInterval(() => {
      const next = countdownFrom(quote.expiresAt).total;
      setRemaining(next);
      if (next <= 0) {
        window.clearInterval(timer);
        onExpired?.();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [quote.expiresAt, onExpired]);

  const seconds = Math.floor(remaining / 1000);
  const expired = remaining <= 0;

  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div className="flex flex-col gap-1.5">
        <Label>You pay</Label>
        <div className="flex items-baseline gap-2">
          <span className="num text-2xl leading-none tracking-tight">{quote.tokenAmountFormatted}</span>
          <span className="num text-xs text-bone-faint">{quote.tokenSymbol}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Label>{expired ? 'Quote expired' : 'Quote holds'}</Label>
        <span className={cn('num text-sm', expired ? 'text-arena' : 'text-bone-dim')}>
          {expired ? 'Refresh' : `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`}
        </span>
      </div>
    </div>
  );
}
