import { formatDisplayAmount } from '@/lib/prena/amount';
import { cn } from '@/lib/cn';
import type { RewardTier } from '@/services/rewards';

/** Human label for a tier, from its configuration. Never hard-coded per Arena. */
export function tierLabel(tier: RewardTier): string {
  if (tier.label) return tier.label;
  if (tier.rewardType === 'champion') return 'Champion';
  if (tier.rewardType === 'percentile') {
    const start = Math.round((tier.percentileStart ?? 0) * 100);
    const end = Math.round((tier.percentileEnd ?? 1) * 100);
    return `Top ${end}%${start > 0 ? ` (from ${start}%)` : ''}`;
  }
  if (tier.rewardType === 'rank') {
    if (tier.rankStart && tier.rankEnd && tier.rankStart === tier.rankEnd) return `#${tier.rankStart}`;
    if (tier.rankStart && tier.rankEnd) return `#${tier.rankStart}–${tier.rankEnd}`;
    if (tier.rankEnd) return `Top ${tier.rankEnd}`;
    return 'Rank';
  }
  if (tier.rewardType === 'supporter') return 'Supporter rewards';
  if (tier.rewardType === 'community') return 'Community rewards';
  return 'Special';
}

export function tierAmount(tier: RewardTier, poolTotal: string): string {
  if (tier.amount != null) return formatDisplayAmount(tier.amount);
  if (tier.percentage != null) {
    return formatDisplayAmount((Number(poolTotal) * tier.percentage) / 100);
  }
  return '—';
}

export function RewardBreakdown({
  tiers,
  poolTotal,
  tokenSymbol = 'PRENA',
  className,
}: {
  tiers: RewardTier[];
  poolTotal: string;
  tokenSymbol?: string;
  className?: string;
}) {
  if (tiers.length === 0) return null;
  return (
    <div className={cn('border-t hairline', className)}>
      {tiers.map((tier) => {
        // Tiers with no deterministic rank mapping are not distributed yet.
        const later = tier.rewardType === 'supporter';
        return (
          <div
            key={tier.id}
            className="flex items-baseline justify-between gap-4 border-b hairline px-4 py-3 last:border-b-0"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest text-bone-dim">
              {tierLabel(tier)}
            </span>
            <span className="num text-sm text-bone">
              {later ? (
                <span className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">Coming later</span>
              ) : (
                <>
                  {tierAmount(tier, poolTotal)}{' '}
                  <span className="text-[11px] text-bone-faint">{tokenSymbol}</span>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
