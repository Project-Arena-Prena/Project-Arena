'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Label, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Arena } from '@/lib/types';
import type { ArenaRewardPool, RewardType } from '@/services/rewards';

const INPUT = 'h-11 w-full border hairline bg-transparent px-3 text-sm text-bone';

const REWARD_TYPES: RewardType[] = ['champion', 'rank', 'percentile', 'supporter', 'community', 'special'];

interface TierDraft {
  key: string;
  rewardType: RewardType;
  label: string;
  rankStart: string;
  rankEnd: string;
  amount: string;
  distribution: 'split' | 'each';
}

function draftFromPool(pool: ArenaRewardPool | null): TierDraft[] {
  if (!pool) return [];
  return pool.tiers.map((tier, index) => ({
    key: `${tier.id}:${index}`,
    rewardType: tier.rewardType,
    label: tier.label,
    rankStart: tier.rankStart?.toString() ?? '',
    rankEnd: tier.rankEnd?.toString() ?? '',
    amount: tier.amount ?? '',
    distribution: tier.distribution,
  }));
}

/**
 * Arena-level $PRENA settings. Token contract, chain, and treasury are
 * inherited from global configuration and are never editable here — the admin
 * UI must not surface addresses it could get wrong, or any secret.
 */
export function ArenaPrenaForm({
  arena,
  pool,
  tokenConfig,
}: {
  arena: Arena;
  pool: ArenaRewardPool | null;
  tokenConfig: { symbol: string; contract: string | null; chainId: number; mode: string };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [prenaEnabled, setPrenaEnabled] = useState(arena.prenaPaymentEnabled);
  const [discount, setDiscount] = useState(String(arena.prenaDiscountPercent));
  const [poolEnabled, setPoolEnabled] = useState(arena.rewardPoolEnabled);
  const [poolAmount, setPoolAmount] = useState(pool?.totalAmount ?? '0');
  const [tiers, setTiers] = useState<TierDraft[]>(draftFromPool(pool));

  const allocated = tiers.reduce((sum, tier) => sum + (Number(tier.amount) || 0), 0);
  const overAllocated = Number(poolAmount) > 0 && allocated > Number(poolAmount);

  async function save() {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/admin/arenas/${arena.id}/prena`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prenaPaymentEnabled: prenaEnabled,
        prenaDiscountPercent: Math.max(0, Math.min(90, Number(discount) || 0)),
        rewardPoolEnabled: poolEnabled,
        rewardPoolAmount: Number(poolAmount) || 0,
        tiers: tiers.map((tier) => ({
          rewardType: tier.rewardType,
          label: tier.label || undefined,
          rankStart: tier.rankStart ? Number(tier.rankStart) : null,
          rankEnd: tier.rankEnd ? Number(tier.rankEnd) : null,
          amount: tier.amount ? Number(tier.amount) : null,
          distribution: tier.distribution,
        })),
      }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    setMessage(response.ok ? 'Saved' : (payload?.error ?? 'Save failed'));
    router.refresh();
  }

  async function rewardAction(action: 'calculate' | 'approve' | 'publish' | 'cancel') {
    setPending(true);
    setMessage(null);
    const response = await fetch('/api/admin/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, arenaId: arena.id }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    setMessage(
      response.ok
        ? action === 'calculate'
          ? `Allocated ${payload?.created ?? 0} rewards`
          : `${payload?.updated ?? 0} updated`
        : (payload?.error ?? 'Action failed'),
    );
    router.refresh();
  }

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <Label>$PRENA Entry</Label>
        <span className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
          {tokenConfig.symbol} · chain {tokenConfig.chainId} · {tokenConfig.mode}
        </span>
      </div>

      <label className="mt-4 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={prenaEnabled}
          onChange={(event) => setPrenaEnabled(event.target.checked)}
          className="h-4 w-4 accent-arena"
        />
        Enable $PRENA payments
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Discount (%)</Label>
          <input
            type="number"
            min={0}
            max={90}
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Token contract</Label>
          <input
            readOnly
            value={tokenConfig.contract ?? 'Inherited from global configuration'}
            className={cn(INPUT, 'font-mono text-[11px] text-bone-faint')}
          />
        </div>
      </div>

      <div className="mt-8 border-t hairline pt-5">
        <Label>Reward pool</Label>
        <label className="mt-3 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={poolEnabled}
            onChange={(event) => setPoolEnabled(event.target.checked)}
            className="h-4 w-4 accent-arena"
          />
          Enable reward pool
        </label>

        <div className="mt-4 flex flex-col gap-2">
          <Label>Pool amount ({tokenConfig.symbol})</Label>
          <input
            type="number"
            min={0}
            step="1"
            value={poolAmount}
            onChange={(event) => setPoolAmount(event.target.value)}
            className={INPUT}
          />
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>Tiers</Label>
            <span className={cn('num text-[11px]', overAllocated ? 'text-arena' : 'text-bone-faint')}>
              {allocated.toLocaleString('en-US')} / {Number(poolAmount || 0).toLocaleString('en-US')} allocated
            </span>
          </div>

          {tiers.map((tier, index) => (
            <div key={tier.key} className="grid gap-2 border hairline p-3 sm:grid-cols-[1fr_1fr_70px_70px_1fr_90px_auto]">
              <select
                value={tier.rewardType}
                onChange={(event) => update(index, { rewardType: event.target.value as RewardType })}
                className={cn(INPUT, 'h-9')}
              >
                {REWARD_TYPES.map((type) => (
                  <option key={type} value={type} className="bg-ink-900">
                    {type}
                  </option>
                ))}
              </select>
              <input
                placeholder="Label"
                value={tier.label}
                onChange={(event) => update(index, { label: event.target.value })}
                className={cn(INPUT, 'h-9')}
              />
              <input
                placeholder="From"
                value={tier.rankStart}
                onChange={(event) => update(index, { rankStart: event.target.value })}
                className={cn(INPUT, 'h-9')}
              />
              <input
                placeholder="To"
                value={tier.rankEnd}
                onChange={(event) => update(index, { rankEnd: event.target.value })}
                className={cn(INPUT, 'h-9')}
              />
              <input
                placeholder="Amount"
                value={tier.amount}
                onChange={(event) => update(index, { amount: event.target.value })}
                className={cn(INPUT, 'h-9')}
              />
              <select
                value={tier.distribution}
                onChange={(event) => update(index, { distribution: event.target.value as 'split' | 'each' })}
                className={cn(INPUT, 'h-9')}
              >
                <option value="split" className="bg-ink-900">split</option>
                <option value="each" className="bg-ink-900">each</option>
              </select>
              <button
                type="button"
                onClick={() => setTiers((current) => current.filter((_, i) => i !== index))}
                className="h-9 border border-arena/30 px-2 font-mono text-[10px] uppercase tracking-widest text-arena"
              >
                Remove
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setTiers((current) => [
                ...current,
                {
                  key: `new-${current.length}-${Date.now()}`,
                  rewardType: 'rank',
                  label: '',
                  rankStart: '',
                  rankEnd: '',
                  amount: '',
                  distribution: 'split',
                },
              ])
            }
            className="h-9 self-start border border-white/15 px-3 font-mono text-[10px] uppercase tracking-widest text-bone-dim hover:text-bone"
          >
            Add tier
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t hairline pt-5">
        <Button type="button" size="sm" disabled={pending} onClick={() => void save()}>
          {pending ? 'Saving' : 'Save $PRENA settings'}
        </Button>
        {(['calculate', 'approve', 'publish', 'cancel'] as const).map((action) => (
          <button
            key={action}
            type="button"
            disabled={pending}
            onClick={() => void rewardAction(action)}
            className="h-8 border border-white/15 px-3 font-mono text-[10px] uppercase tracking-widest text-bone-dim hover:text-bone"
          >
            {action === 'calculate'
              ? 'Calculate rewards'
              : action === 'approve'
                ? 'Approve'
                : action === 'publish'
                  ? 'Make claimable'
                  : 'Cancel rewards'}
          </button>
        ))}
        {message ? <span className="font-mono text-[10px] uppercase tracking-widest text-bone-dim">{message}</span> : null}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-bone-faint">
        Rewards read frozen final rankings. Nothing here can change an Arena score.
      </p>
    </Panel>
  );

  function update(index: number, patch: Partial<TierDraft>) {
    setTiers((current) => current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  }
}
