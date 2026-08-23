'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { prenaError } from '@/lib/prena/errors';
import { shortAddress } from '@/lib/prena/config';
import { useWallet } from './wallet-provider';
import { WalletError } from './wallet-button';

type ClaimPhase = 'idle' | 'preparing' | 'signing' | 'submitting' | 'claimed' | 'failed';

/**
 * Claiming requires a fresh signature from the wallet the reward is addressed
 * to. The server owns the amount and the one-claim guarantee; this component
 * only collects the proof and reports what happened.
 */
export function ClaimRewardButton({
  allocationId,
  amountFormatted,
  tokenSymbol = 'PRENA',
  expectedWallet,
  claimed,
  className,
}: {
  allocationId: string;
  amountFormatted: string;
  tokenSymbol?: string;
  expectedWallet?: string | null;
  claimed?: boolean;
  className?: string;
}) {
  const wallet = useWallet();
  const router = useRouter();
  const [phase, setPhase] = useState<ClaimPhase>(claimed ? 'claimed' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(true);

  if (phase === 'claimed') {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-live">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Claimed
        </span>
        <span className="num text-sm text-bone">
          {amountFormatted} {tokenSymbol}
        </span>
        {!settled ? (
          <span className="text-[11px] text-bone-faint">
            Payout is queued. It lands in your wallet once the distributor settles.
          </span>
        ) : null}
      </div>
    );
  }

  const walletMismatch = Boolean(
    expectedWallet && wallet.address && wallet.address !== expectedWallet,
  );

  async function claim() {
    setError(null);

    if (!wallet.address || !wallet.isLinked) {
      const linked = await wallet.linkWallet();
      if (!linked) return;
    }
    if (wallet.wrongNetwork) {
      const switched = await wallet.switchNetwork();
      if (!switched) return;
    }
    if (expectedWallet && wallet.address !== expectedWallet) {
      setPhase('failed');
      setError('wallet_mismatch');
      return;
    }

    setPhase('preparing');
    const challengeResponse = await fetch('/api/rewards/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocationId }),
    }).catch(() => null);

    const challenge = (await challengeResponse?.json().catch(() => null)) as
      | { nonce: string; message: string; address: string; error?: string }
      | null;
    if (!challengeResponse?.ok || !challenge?.message) {
      setPhase('failed');
      setError(challenge?.error ?? 'claim_failed');
      return;
    }

    setPhase('signing');
    const signature = await wallet.signMessage(challenge.message);
    if (!signature) {
      setPhase('failed');
      setError('signature_rejected');
      return;
    }

    setPhase('submitting');
    const response = await fetch('/api/rewards/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allocationId,
        walletAddress: challenge.address,
        nonce: challenge.nonce,
        message: challenge.message,
        signature,
      }),
    }).catch(() => null);

    const payload = (await response?.json().catch(() => null)) as
      | { ok?: boolean; settled?: boolean; error?: string }
      | null;

    if (!response?.ok || !payload?.ok) {
      setPhase('failed');
      setError(payload?.error ?? 'claim_failed');
      return;
    }

    setSettled(payload.settled !== false);
    setPhase('claimed');
    router.refresh();
  }

  const busy = phase === 'preparing' || phase === 'signing' || phase === 'submitting';
  const busyCopy =
    phase === 'signing' ? 'Confirm in wallet' : phase === 'submitting' ? 'Claiming' : 'Preparing';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Button type="button" size="sm" disabled={busy} onClick={() => void claim()}>
        {busy ? busyCopy : 'Claim Reward'}
      </Button>

      {walletMismatch && expectedWallet ? (
        <p className="text-[11px] text-bone-faint">
          Addressed to {shortAddress(expectedWallet)}. Switch to that wallet to claim.
        </p>
      ) : null}

      {phase === 'failed' && error ? (
        <p className="font-mono text-[10px] uppercase tracking-widest text-arena">
          <span className="normal-case tracking-normal">{prenaError(error)}</span>
        </p>
      ) : null}

      {wallet.error ? <WalletError code={wallet.error} /> : null}
    </div>
  );
}
