'use client';

import { useState } from 'react';
import { AlertCircle, Wallet } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { prenaError, isRetryable } from '@/lib/prena/errors';
import { shortAddress, useWallet } from './wallet-provider';

/**
 * The single entry point to the wallet. Ordinary visitors never see it — it
 * only renders inside the authenticated Builder account area.
 */
export function WalletButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);

  if (wallet.status === 'checking') {
    return <span className={cn('label', className)}>Checking wallet</span>;
  }

  if (wallet.status === 'unavailable') {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {wallet.mobileWalletUrl ? (
          <a
            href={wallet.mobileWalletUrl}
            className="inline-flex h-9 items-center gap-2 border border-white/15 px-3 font-mono text-[10px] uppercase tracking-widest text-bone-dim hover:text-bone"
          >
            <Wallet className="h-3.5 w-3.5" />
            Open in wallet app
          </a>
        ) : (
          <span className="label">No wallet detected</span>
        )}
        {!compact ? (
          <p className="max-w-xs text-xs text-bone-faint">
            A wallet is optional. Card entry works without one.
          </p>
        ) : null}
      </div>
    );
  }

  const linked = wallet.linkedWallets.find((item) => item.address === wallet.address);

  if (wallet.status !== 'connected') {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Button
          type="button"
          size={compact ? 'sm' : 'md'}
          variant="secondary"
          disabled={wallet.busy}
          onClick={() => void wallet.linkWallet()}
        >
          <Wallet className="h-3.5 w-3.5" />
          {wallet.busy ? 'Connecting' : 'Connect Wallet'}
        </Button>
        <WalletError code={wallet.error} onRetry={() => void wallet.linkWallet()} />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-9 items-center gap-2 border border-white/15 px-3 font-mono text-[10px] uppercase tracking-widest text-bone hover:border-white/40"
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              wallet.wrongNetwork ? 'bg-arena' : linked?.verifiedAt ? 'bg-live' : 'bg-bone-faint',
            )}
            aria-hidden
          />
          {shortAddress(wallet.address)}
        </button>

        {wallet.wrongNetwork ? (
          <Button type="button" size="sm" onClick={() => void wallet.switchNetwork()} disabled={wallet.busy}>
            Switch to {wallet.expectedChainName}
          </Button>
        ) : null}

        {!wallet.isLinked && !wallet.wrongNetwork ? (
          <Button type="button" size="sm" onClick={() => void wallet.linkWallet()} disabled={wallet.busy}>
            {wallet.busy ? 'Verifying' : 'Verify wallet'}
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="flex flex-col gap-2 border hairline bg-ink-900/60 p-3">
          <span className="label">Wallet</span>
          <code className="break-all font-mono text-[11px] text-bone-dim">{wallet.address}</code>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                wallet.disconnect();
                setOpen(false);
              }}
              className="h-8 border border-white/15 px-3 font-mono text-[10px] uppercase tracking-widest text-bone-dim hover:text-bone"
            >
              Disconnect
            </button>
            {linked ? (
              <button
                type="button"
                disabled={wallet.busy}
                onClick={() => void wallet.unlinkWallet(linked.id).then(() => setOpen(false))}
                className="h-8 border border-arena/30 px-3 font-mono text-[10px] uppercase tracking-widest text-arena hover:border-arena"
              >
                Unlink from account
              </button>
            ) : null}
          </div>
          <p className="text-[11px] leading-relaxed text-bone-faint">
            Project Arena never holds your keys and never asks for a seed phrase.
          </p>
        </div>
      ) : null}

      <WalletError code={wallet.error} onRetry={() => void wallet.linkWallet()} />
    </div>
  );
}

export function WalletError({ code, onRetry }: { code: string | null; onRetry?: () => void }) {
  if (!code) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-arena">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span className="normal-case tracking-normal">{prenaError(code)}</span>
      {isRetryable(code) && onRetry ? (
        <button type="button" onClick={onRetry} className="underline underline-offset-2 hover:text-arena-hot">
          Retry
        </button>
      ) : null}
    </p>
  );
}
