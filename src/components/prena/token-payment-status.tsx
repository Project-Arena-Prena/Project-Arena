'use client';

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui';
import { cn } from '@/lib/cn';
import { explorerTxUrl } from '@/lib/prena/config';
import { prenaError, isRetryable } from '@/lib/prena/errors';

export type PaymentPhase =
  | 'idle'
  | 'quoting'
  | 'awaiting_wallet'
  | 'submitted'
  | 'confirming'
  | 'confirmed'
  | 'failed';

const PHASE_COPY: Record<PaymentPhase, string> = {
  idle: '',
  quoting: 'Preparing your quote',
  awaiting_wallet: 'Confirm in your wallet',
  submitted: 'Transaction submitted',
  confirming: 'Waiting for confirmation',
  confirmed: 'Entry confirmed',
  failed: 'Payment did not complete',
};

/**
 * Transaction feedback. Every terminal state names what happened; nothing here
 * can sit on a spinner forever because `failed` always carries a reason.
 */
export function TokenPaymentStatus({
  phase,
  txHash,
  error,
  onRetry,
  className,
}: {
  phase: PaymentPhase;
  txHash?: string | null;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  if (phase === 'idle') return null;
  const explorer = explorerTxUrl(txHash);
  const pending = phase === 'quoting' || phase === 'awaiting_wallet' || phase === 'submitted' || phase === 'confirming';

  return (
    <div className={cn('flex flex-col gap-2 border hairline bg-ink-900/60 px-4 py-3', className)}>
      <div className="flex items-center gap-2">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-bone-dim" /> : null}
        {phase === 'confirmed' ? <CheckCircle2 className="h-3.5 w-3.5 text-live" /> : null}
        {phase === 'failed' ? <AlertCircle className="h-3.5 w-3.5 text-arena" /> : null}
        <Label className={phase === 'confirmed' ? 'text-live' : phase === 'failed' ? 'text-arena' : undefined}>
          {PHASE_COPY[phase]}
        </Label>
      </div>

      {phase === 'failed' && error ? <p className="text-xs text-bone-dim">{prenaError(error)}</p> : null}

      {phase === 'confirming' ? (
        <p className="text-xs text-bone-faint">
          Your spot is held. You can close this page — the entry completes on its own.
        </p>
      ) : null}

      {txHash ? (
        <p className="break-all font-mono text-[10px] text-bone-faint">
          {explorer ? (
            <a href={explorer} target="_blank" rel="noopener noreferrer" className="hover:text-bone">
              {txHash}
            </a>
          ) : (
            txHash
          )}
        </p>
      ) : null}

      {phase === 'failed' && onRetry && isRetryable(error) ? (
        <button
          type="button"
          onClick={onRetry}
          className="self-start font-mono text-[10px] uppercase tracking-widest text-bone-dim underline underline-offset-2 hover:text-bone"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
