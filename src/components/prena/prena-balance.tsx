'use client';

import { useCallback, useEffect, useState } from 'react';
import { Label } from '@/components/ui';
import { cn } from '@/lib/cn';
import { prenaError } from '@/lib/prena/errors';
import { useWallet } from './wallet-provider';

/**
 * Utility balance, not a portfolio. No fiat value, no price, no chart — the
 * number matters only because it is what can enter Arenas.
 */

export interface PrenaBalanceData {
  raw: string;
  formatted: string;
  symbol: string;
  decimals: number;
  chainId: number;
  mode: 'mock' | 'onchain';
}

export function usePrenaBalance() {
  const wallet = useWallet();
  const [balance, setBalance] = useState<PrenaBalanceData | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const address = wallet.address;
  const linked = wallet.isLinked;

  const load = useCallback(async () => {
    if (!address || !linked) {
      setBalance(null);
      setState('idle');
      return;
    }
    setState('loading');
    setError(null);
    try {
      const response = await fetch(`/api/wallet/balance?address=${address}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | { balance?: PrenaBalanceData; error?: string }
        | null;
      if (!response.ok || !payload?.balance) {
        setState('error');
        setError(payload?.error ?? 'rpc_unavailable');
        return;
      }
      setBalance(payload.balance);
      setState('ready');
    } catch {
      setState('error');
      setError('network_error');
    }
  }, [address, linked]);

  useEffect(() => {
    void load();
  }, [load]);

  return { balance, state, error, reload: load };
}

export function PrenaBalance({
  className,
  showLabel = true,
  size = 'md',
}: {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const wallet = useWallet();
  const { balance, state, error, reload } = usePrenaBalance();

  const valueClass = cn(
    'num leading-none tracking-tight text-bone',
    size === 'lg' ? 'text-4xl sm:text-5xl' : size === 'sm' ? 'text-lg' : 'text-3xl',
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {showLabel ? <Label>$PRENA Balance</Label> : null}

      {wallet.status === 'unavailable' || !wallet.address ? (
        <>
          <span className={cn(valueClass, 'text-bone-faint')}>—</span>
          <p className="text-xs text-bone-faint">Connect a wallet to see your balance.</p>
        </>
      ) : !wallet.isLinked ? (
        <>
          <span className={cn(valueClass, 'text-bone-faint')}>—</span>
          <p className="text-xs text-bone-faint">Verify this wallet to read its balance.</p>
        </>
      ) : wallet.wrongNetwork ? (
        <>
          <span className={cn(valueClass, 'text-bone-faint')}>—</span>
          <p className="text-xs text-bone-faint">
            Wrong network.{' '}
            <button type="button" onClick={() => void wallet.switchNetwork()} className="underline underline-offset-2">
              Switch to {wallet.expectedChainName}
            </button>
          </p>
        </>
      ) : state === 'loading' || state === 'idle' ? (
        <span className={cn(valueClass, 'text-bone-faint')} aria-busy>
          ————
        </span>
      ) : state === 'error' ? (
        <>
          <span className={cn(valueClass, 'text-bone-faint')}>—</span>
          <p className="text-xs text-bone-faint">
            {prenaError(error)}{' '}
            <button type="button" onClick={() => void reload()} className="underline underline-offset-2">
              Retry
            </button>
          </p>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className={valueClass}>{balance?.formatted ?? '0'}</span>
            <span className="num text-xs text-bone-faint">{balance?.symbol ?? 'PRENA'}</span>
          </div>
          <p className="text-xs text-bone-faint">
            {balance && balance.raw === '0'
              ? 'No $PRENA yet. Card entry works without it.'
              : 'Utility balance available'}
          </p>
        </>
      )}
    </div>
  );
}
