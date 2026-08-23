'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Label } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { prenaPublicConfig } from '@/lib/prena/config';
import type { Arena } from '@/lib/types';
import { PrenaQuote, type QuoteData } from './prena-quote';
import { TokenPaymentStatus, type PaymentPhase } from './token-payment-status';
import { usePrenaBalance } from './prena-balance';
import { useWallet } from './wallet-provider';
import { WalletButton, WalletError } from './wallet-button';

/**
 * The $PRENA half of Arena entry. Card entry is unchanged and always available;
 * this option only appears when the Arena enables it.
 *
 * The browser never decides what was paid: it requests a server quote, asks the
 * wallet to send exactly that amount, and hands the hash back for server-side
 * verification. The Entry is created by the backend, not here.
 */

interface Intent {
  tokenPaymentId: string;
  tokenAmount: string;
  tokenAmountFormatted: string;
  tokenContract: string | null;
  chainId: number;
  recipientAddress: string;
  mode: 'mock' | 'onchain';
}

function storageKey(arenaSlug: string, projectId: string) {
  return `prena.payment.${arenaSlug}.${projectId}`;
}

export function PrenaEntryOption({
  arena,
  projectId,
  disabled,
  className,
}: {
  arena: Arena;
  projectId: string | null;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const wallet = useWallet();
  const { balance, state: balanceState, reload: reloadBalance } = usePrenaBalance();

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [phase, setPhase] = useState<PaymentPhase>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const clearStored = useCallback(() => {
    if (!projectId) return;
    try {
      window.localStorage.removeItem(storageKey(arena.slug, projectId));
    } catch {
      // Nothing to clean up; the server still holds the authoritative state.
    }
  }, [arena.slug, projectId]);

  // Server-side polling. This is what makes an in-flight payment survive a
  // refresh: the payment id is the only thing kept locally.
  const pollPayment = useCallback(
    (tokenPaymentId: string) => {
      stopPolling();
      let attempts = 0;
      const tick = async () => {
        attempts += 1;
        try {
          const response = await fetch(`/api/prena/payment/${tokenPaymentId}`, { cache: 'no-store' });
          if (!response.ok) {
            if (response.status === 404) {
              stopPolling();
              clearStored();
              setPhase('idle');
            }
            return;
          }
          const payload = (await response.json()) as {
            status: string;
            txHash: string | null;
            failureReason: string | null;
            entryStatus: string | null;
          };
          if (payload.txHash) setTxHash(payload.txHash);

          if (payload.status === 'confirmed') {
            stopPolling();
            clearStored();
            setPhase('confirmed');
            void reloadBalance();
            router.push(`/enter/success?arena=${arena.slug}`);
            return;
          }
          if (['failed', 'expired', 'refunded'].includes(payload.status)) {
            stopPolling();
            clearStored();
            setPhase('failed');
            setError(payload.failureReason ?? 'transaction_failed');
            return;
          }
          if (payload.status === 'confirming') {
            setPhase('confirming');
            // Nudge the backend to re-read the chain while it settles.
            if (payload.txHash) {
              await fetch('/api/prena/entry/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokenPaymentId, txHash: payload.txHash }),
              }).catch(() => undefined);
            }
          }
          // Give up on an unattended hold rather than spinning indefinitely.
          if (attempts > 60) {
            stopPolling();
            setPhase('failed');
            setError('rpc_unavailable');
          }
        } catch {
          if (attempts > 60) {
            stopPolling();
            setPhase('failed');
            setError('network_error');
          }
        }
      };
      void tick();
      pollRef.current = window.setInterval(() => void tick(), 5000);
    },
    [arena.slug, clearStored, reloadBalance, router, stopPolling],
  );

  // Resume an in-flight payment after a reload.
  useEffect(() => {
    if (!projectId) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(storageKey(arena.slug, projectId));
    } catch {
      stored = null;
    }
    if (!stored) return;
    setPhase('confirming');
    pollPayment(stored);
  }, [arena.slug, projectId, pollPayment]);

  const fetchQuote = useCallback(async () => {
    if (!projectId) return null;
    setPhase('quoting');
    setError(null);
    try {
      const response = await fetch('/api/prena/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arenaSlug: arena.slug, projectId }),
      });
      const payload = (await response.json().catch(() => null)) as { quote?: QuoteData; error?: string } | null;
      if (!response.ok || !payload?.quote) {
        setPhase('failed');
        setError(payload?.error ?? 'price_unavailable');
        return null;
      }
      setQuote(payload.quote);
      setPhase('idle');
      return payload.quote;
    } catch {
      setPhase('failed');
      setError('network_error');
      return null;
    }
  }, [arena.slug, projectId]);

  // Keep a fresh quote on screen while the option is usable.
  useEffect(() => {
    if (!projectId || !arena.prenaPaymentEnabled) return;
    if (phase !== 'idle') return;
    if (quote && Date.parse(quote.expiresAt) > Date.now()) return;
    void fetchQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, arena.prenaPaymentEnabled]);

  const insufficient =
    balanceState === 'ready' &&
    balance != null &&
    quote != null &&
    BigInt(balance.raw) < BigInt(quote.tokenAmount);

  const pay = useCallback(async () => {
    if (!projectId) return;
    setError(null);

    if (!wallet.address || !wallet.isLinked) {
      const linked = await wallet.linkWallet();
      if (!linked) return;
    }
    if (wallet.wrongNetwork) {
      const switched = await wallet.switchNetwork();
      if (!switched) return;
    }

    const active = quote && Date.parse(quote.expiresAt) > Date.now() ? quote : await fetchQuote();
    if (!active) return;

    setPhase('awaiting_wallet');
    const intentResponse = await fetch('/api/prena/entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arenaSlug: arena.slug,
        projectId,
        quoteId: active.id,
        walletAddress: wallet.address,
      }),
    }).catch(() => null);

    const intentPayload = (await intentResponse?.json().catch(() => null)) as
      | { intent?: Intent; error?: string }
      | null;
    if (!intentResponse?.ok || !intentPayload?.intent) {
      setPhase('failed');
      setError(intentPayload?.error ?? 'network_error');
      setQuote(null);
      return;
    }

    const created = intentPayload.intent;
    setIntent(created);
    try {
      window.localStorage.setItem(storageKey(arena.slug, projectId), created.tokenPaymentId);
    } catch {
      // The payment still completes; only cross-refresh resume is lost.
    }

    // Mock mode has no wallet transaction to sign; the backend settles the
    // simulated transfer through the identical verification path.
    if (created.mode === 'mock') {
      setPhase('confirming');
      await fetch('/api/prena/entry/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenPaymentId: created.tokenPaymentId, simulate: true }),
      }).catch(() => undefined);
      pollPayment(created.tokenPaymentId);
      return;
    }

    const sent = await wallet.sendTokenTransfer({
      tokenContract: created.tokenContract ?? prenaPublicConfig.tokenAddress,
      to: created.recipientAddress,
      amount: created.tokenAmount,
    });

    if ('error' in sent) {
      setPhase('failed');
      setError(sent.error);
      clearStored();
      // Release the held slot immediately on a declined signature.
      await fetch('/api/prena/entry/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenPaymentId: created.tokenPaymentId }),
      }).catch(() => undefined);
      return;
    }

    setTxHash(sent.txHash);
    setPhase('submitted');
    await fetch('/api/prena/entry/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenPaymentId: created.tokenPaymentId, txHash: sent.txHash }),
    }).catch(() => undefined);
    setPhase('confirming');
    pollPayment(created.tokenPaymentId);
  }, [arena.slug, clearStored, fetchQuote, pollPayment, projectId, quote, wallet]);

  if (!arena.prenaPaymentEnabled) return null;

  const busy = phase === 'quoting' || phase === 'awaiting_wallet' || phase === 'submitted' || phase === 'confirming';

  return (
    <div className={cn('flex flex-col gap-4 border hairline bg-ink-900/60 p-4', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>$PRENA</Label>
          <div className="flex items-baseline gap-2">
            <span className="num text-2xl leading-none tracking-tight">
              {quote?.tokenAmountFormatted ?? '————'}
            </span>
            <span className="num text-xs text-bone-faint">PRENA</span>
          </div>
          {quote ? (
            <span className="num text-[11px] text-bone-faint">
              ≈ {formatMoney(Math.round(quote.discountedUsdAmount * 100))}
            </span>
          ) : null}
        </div>
        {arena.prenaDiscountPercent > 0 ? (
          <span className="shrink-0 border border-live/30 bg-live/[0.08] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-live">
            Save {arena.prenaDiscountPercent}%
          </span>
        ) : null}
      </div>

      {quote ? <PrenaQuote quote={quote} onExpired={() => void fetchQuote()} /> : null}

      {wallet.status === 'unavailable' || !wallet.isLinked ? (
        <div className="flex flex-col gap-2 border-t hairline pt-4">
          <p className="text-xs text-bone-dim">Connect a wallet to enter with $PRENA.</p>
          <WalletButton compact />
        </div>
      ) : (
        <>
          {insufficient ? (
            <div className="border border-arena/30 bg-arena/[0.06] px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-arena">Insufficient $PRENA</p>
              <p className="mt-1 text-xs text-bone-dim">
                You hold {balance?.formatted ?? '0'} PRENA. Card entry still works.
              </p>
            </div>
          ) : null}

          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            disabled={Boolean(disabled) || busy || !projectId || insufficient || !quote}
            onClick={() => void pay()}
          >
            {busy ? 'Processing' : 'Pay with $PRENA'}
          </Button>
        </>
      )}

      <TokenPaymentStatus
        phase={phase}
        txHash={txHash}
        error={error}
        onRetry={() => {
          setPhase('idle');
          setError(null);
          setTxHash(null);
          setIntent(null);
          void fetchQuote();
        }}
      />

      {error && phase !== 'failed' ? <WalletError code={error} /> : null}
      {wallet.error ? <WalletError code={wallet.error} /> : null}

      {intent?.mode === 'mock' || quote?.mode === 'mock' ? (
        <p className="font-mono text-[9px] uppercase tracking-widest text-bone-faint">
          Development mode — simulated settlement
        </p>
      ) : null}

      <p className="text-[11px] leading-relaxed text-bone-faint">
        $PRENA buys a slot and a discount. It does not buy rank, votes, or Champion.
      </p>
    </div>
  );
}
