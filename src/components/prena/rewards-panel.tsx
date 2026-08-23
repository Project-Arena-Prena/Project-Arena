'use client';

import Link from 'next/link';
import { Label, Panel } from '@/components/ui';
import { formatDate } from '@/lib/format';
import type { RewardAllocation } from '@/services/rewards';
import { ClaimRewardButton } from './claim-reward-button';

const RANK_MARK: Record<string, string> = { champion: '🏆' };

/** Rewards a Builder can act on. Amounts come from the server, never the client. */
export function RewardsPanel({ rewards }: { rewards: RewardAllocation[] }) {
  if (rewards.length === 0) return null;

  return (
    <Panel>
      <div className="flex items-center justify-between border-b hairline px-5 py-3">
        <Label>Rewards</Label>
        <Link
          href="/dashboard/prena?filter=rewards"
          className="font-mono text-[10px] uppercase tracking-widest text-bone-faint hover:text-bone"
        >
          All rewards
        </Link>
      </div>
      {rewards.map((reward) => (
        <div
          key={reward.id}
          className="flex flex-col gap-3 border-b hairline px-5 py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
              {reward.arenaSlug ? (
                <Link href={`/arena/${reward.arenaSlug}`} className="hover:text-bone">
                  {reward.arenaName}
                </Link>
              ) : (
                reward.arenaName
              )}
            </p>
            <p className="mt-2 text-sm">
              {RANK_MARK[reward.rewardType] ? `${RANK_MARK[reward.rewardType]} ` : ''}
              {reward.label || (reward.finalRank ? `#${reward.finalRank}` : 'Reward')}
              <span className="text-bone-faint"> · {reward.projectName}</span>
            </p>
            <p className="num mt-2 text-2xl leading-none tracking-tight">
              {reward.amountFormatted} <span className="text-sm text-bone-faint">{reward.tokenSymbol}</span>
            </p>
            {reward.status === 'claimed' && reward.claimedAt ? (
              <p className="num mt-2 text-[11px] text-bone-faint">Claimed {formatDate(reward.claimedAt)}</p>
            ) : null}
          </div>
          <div className="shrink-0">
            {reward.status === 'claimable' || reward.status === 'claimed' ? (
              <ClaimRewardButton
                allocationId={reward.id}
                amountFormatted={reward.amountFormatted}
                tokenSymbol={reward.tokenSymbol}
                expectedWallet={reward.walletAddress}
                claimed={reward.status === 'claimed'}
              />
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                {reward.status === 'pending' || reward.status === 'approved' ? 'Awaiting verification' : reward.status}
              </span>
            )}
          </div>
        </div>
      ))}
    </Panel>
  );
}
