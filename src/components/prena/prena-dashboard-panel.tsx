'use client';

import Link from 'next/link';
import { Label, Panel } from '@/components/ui';
import { formatDisplayAmount } from '@/lib/prena/amount';
import { PrenaBalance } from './prena-balance';
import { PrenaBenefitBadge } from './prena-benefit-badge';
import { WalletButton } from './wallet-button';
import { useWallet } from './wallet-provider';

export interface PrenaSummary {
  claimable: string;
  earned: string;
  spent: string;
  pending: string;
}

/**
 * A compact strip on the Builder dashboard. Deliberately small — Project Arena
 * is a competition product, not a crypto application.
 */
export function PrenaDashboardPanel({
  summary,
  benefits,
  hasWallet,
}: {
  summary: PrenaSummary;
  benefits: { earlyRegistrationEligible: boolean; verifiedBuilderEligible: boolean };
  hasWallet: boolean;
}) {
  const wallet = useWallet();
  const connected = hasWallet || wallet.isLinked;

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b hairline px-5 py-3">
        <Label>$PRENA</Label>
        <div className="flex flex-wrap items-center gap-2">
          {benefits.verifiedBuilderEligible ? <PrenaBenefitBadge benefit="verified" /> : null}
          <Link
            href="/dashboard/prena"
            className="font-mono text-[10px] uppercase tracking-widest text-bone-faint hover:text-bone"
          >
            View activity
          </Link>
        </div>
      </div>

      {!connected ? (
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-bone">Connect a wallet to use $PRENA.</p>
            <p className="mt-1 text-xs text-bone-faint">
              Optional. Card entry works exactly as before, and rank never depends on it.
            </p>
          </div>
          <WalletButton compact />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-6 px-5 py-5 md:grid-cols-4">
            <PrenaBalance showLabel size="sm" />
            <Metric label="Claimable" value={summary.claimable} accent={Number(summary.claimable) > 0} />
            <Metric label="Earned" value={summary.earned} />
            <Metric label="Spent on Arenas" value={summary.spent} />
          </div>
          <div className="border-t hairline px-5 py-3">
            <WalletButton compact />
          </div>
        </>
      )}
    </Panel>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <span className={`num text-lg leading-none tracking-tight ${accent ? 'text-gold' : 'text-bone'}`}>
        {formatDisplayAmount(value)}
      </span>
    </div>
  );
}
