import type { Metadata } from 'next';
import { requireBuilder } from '@/lib/auth';
import { Container, Label, Panel, SectionHeader } from '@/components/ui';
import { getPrenaActivity, type ActivityFilter } from '@/services/activity';
import { getBuilderPrenaSummary, listBuilderRewards } from '@/services/rewards';
import { getBuilderPrenaBenefits } from '@/services/benefits';
import { getBuilderWallets } from '@/services/wallet';
import { formatDisplayAmount } from '@/lib/prena/amount';
import { prenaPublicConfig } from '@/lib/prena/config';
import { PrenaActivityFilters, PrenaActivityList } from '@/components/prena/prena-activity-list';
import { PrenaBalance } from '@/components/prena/prena-balance';
import { PrenaBenefitBadge } from '@/components/prena/prena-benefit-badge';
import { RewardsPanel } from '@/components/prena/rewards-panel';
import { WalletButton } from '@/components/prena/wallet-button';

export const metadata: Metadata = {
  title: '$PRENA',
  description: 'Entries paid with $PRENA, rewards earned in Arenas, and claim history.',
};

const FILTERS: ActivityFilter[] = ['all', 'entries', 'rewards', 'claims'];

export default async function PrenaActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const ctx = await requireBuilder('/dashboard/prena');
  const { filter: requested } = await searchParams;
  const filter = (FILTERS.includes(requested as ActivityFilter) ? requested : 'all') as ActivityFilter;

  const [activity, summary, rewards, wallets, benefits] = await Promise.all([
    getPrenaActivity(ctx.builder.id, { filter, limit: 200 }),
    getBuilderPrenaSummary(ctx.builder.id),
    listBuilderRewards(ctx.builder.id, ['claimable', 'approved', 'pending']),
    getBuilderWallets(ctx.builder.id),
    getBuilderPrenaBenefits(ctx.builder.id),
  ]);

  const hasWallet = wallets.some((wallet) => wallet.verifiedAt);

  return (
    <>
      <section className="border-b hairline">
        <Container className="py-10">
          <Label>$PRENA</Label>
          <h1 className="mt-4 text-4xl font-semibold tracking-headline">Utility activity</h1>
          <p className="mt-3 max-w-xl text-sm text-bone-dim">
            What you spent entering Arenas and what you earned competing in them. $PRENA buys
            participation — never rank, votes, or score.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <WalletButton />
            {benefits.verifiedBuilderEligible ? <PrenaBenefitBadge benefit="verified" /> : null}
            {/* No early-registration badge: see canRegisterEarly — no gate honours it yet. */}
            {benefits.entryDiscountEligible ? <PrenaBenefitBadge benefit="entry_discount" /> : null}
          </div>
        </Container>
      </section>

      <Container className="pt-10">
        <Panel>
          <div className="grid grid-cols-2 gap-6 px-5 py-6 md:grid-cols-4">
            <PrenaBalance showLabel size="sm" />
            <Metric label="Claimable" value={summary.claimable} accent={Number(summary.claimable) > 0} />
            <Metric label="Earned" value={summary.earned} />
            <Metric label="Spent on Arenas" value={summary.spent} />
          </div>
          {!hasWallet ? (
            <p className="border-t hairline px-5 py-3 text-xs text-bone-faint">
              No wallet linked. Entering with a card works exactly as before.
            </p>
          ) : null}
        </Panel>
      </Container>

      {rewards.length > 0 ? (
        <Container className="pt-10">
          <SectionHeader eyebrow="Earned" title="Rewards" />
          <RewardsPanel rewards={rewards} />
        </Container>
      ) : null}

      <Container className="pt-10">
        <SectionHeader
          eyebrow="History"
          title="Activity"
          action={<PrenaActivityFilters active={filter} />}
        />
        <PrenaActivityList items={activity} />
      </Container>

      {prenaPublicConfig.mode === 'mock' ? (
        <Container className="pt-8">
          <p className="font-mono text-[9px] uppercase tracking-widest text-bone-faint">
            Development mode — $PRENA settlement is simulated
          </p>
        </Container>
      ) : null}
    </>
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
