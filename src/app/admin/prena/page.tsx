import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { Container, EmptyState, Label, Panel } from '@/components/ui';
import { listAdminAllocations, listAdminTokenPayments } from '@/lib/admin-queries';
import { getPrenaEconomyTotals } from '@/services/rewards';
import { prenaTokenDescriptor } from '@/services/token';
import { prenaConfigGaps, prenaServerConfig, shortAddress } from '@/lib/prena/config';
import { formatDisplayAmount } from '@/lib/prena/amount';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Admin $PRENA' };

/**
 * Operational data only. This is a ledger view for running the product — not
 * token-market analytics, and it never renders a secret or a private key.
 */
export default async function AdminPrenaPage() {
  await requireAdmin('/admin/prena');

  const [totals, payments, allocations] = await Promise.all([
    getPrenaEconomyTotals(),
    listAdminTokenPayments(),
    listAdminAllocations(),
  ]);
  const token = prenaTokenDescriptor();
  const gaps = prenaConfigGaps();

  const open = payments.filter((payment) => ['pending', 'confirming'].includes(payment.status));
  const failed = payments.filter((payment) => ['failed', 'expired'].includes(payment.status));

  return (
    <Container className="py-12">
      <Label>$PRENA Economy</Label>
      <h1 className="mt-3 text-4xl font-semibold tracking-headline">Token operations</h1>

      <Panel className="mt-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Mode" value={prenaServerConfig.mode} accent={prenaServerConfig.mode === 'mock'} />
          <Field label="Chain" value={String(token.chainId)} />
          <Field label="Token" value={token.contract ? shortAddress(token.contract) : 'not configured'} />
          <Field
            label="Treasury"
            value={prenaServerConfig.treasuryAddress ? shortAddress(prenaServerConfig.treasuryAddress) : 'not configured'}
          />
        </div>
        {prenaServerConfig.mode === 'mock' ? (
          <p className="mt-4 border-t hairline pt-4 text-xs text-bone-dim">
            Development mode. Balances, transfers, and claims are simulated. Production requires
            <span className="font-mono"> PRENA_MODE=onchain</span> plus a deployed token, a treasury,
            an RPC endpoint, and a trusted price source.
          </p>
        ) : gaps.length > 0 ? (
          <p className="mt-4 border-t hairline pt-4 font-mono text-[10px] uppercase tracking-widest text-arena">
            Missing configuration: {gaps.join(', ')}
          </p>
        ) : null}
      </Panel>

      <div className="mt-8 grid grid-cols-2 border hairline md:grid-cols-3 lg:grid-cols-6">
        <Metric label="Arena entry volume" value={`${formatDisplayAmount(totals.entryVolume)}`} suffix={token.symbol} />
        <Metric label="Rewards allocated" value={formatDisplayAmount(totals.rewardsAllocated)} suffix={token.symbol} />
        <Metric label="Rewards claimed" value={formatDisplayAmount(totals.rewardsClaimed)} suffix={token.symbol} />
        <Metric label="Unclaimed" value={formatDisplayAmount(totals.rewardsUnclaimed)} suffix={token.symbol} />
        <Metric label="Token payments" value={String(totals.tokenPayments)} />
        <Metric label="Linked wallets" value={String(totals.buildersWithWallets)} />
      </div>

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <Label>Pending confirmations</Label>
          <span className="num text-[11px] text-bone-faint">{open.length}</span>
        </div>
        <div className="mt-4">
          {open.length === 0 ? (
            <EmptyState title="Nothing pending" />
          ) : (
            <PaymentTable rows={open} />
          )}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <Label>Failed transactions</Label>
          <span className="num text-[11px] text-bone-faint">{failed.length}</span>
        </div>
        <div className="mt-4">
          {failed.length === 0 ? <EmptyState title="No failures" /> : <PaymentTable rows={failed} />}
        </div>
      </section>

      <section className="mt-12">
        <Label>Token payments</Label>
        <div className="mt-4">
          {payments.length === 0 ? (
            <EmptyState title="No token payments yet" hint="They appear when a Builder enters with $PRENA." />
          ) : (
            <PaymentTable rows={payments.slice(0, 50)} />
          )}
        </div>
      </section>

      <section className="mt-12">
        <Label>Reward allocations</Label>
        <div className="mt-4">
          {allocations.length === 0 ? (
            <EmptyState title="No allocations yet" hint="Calculate rewards from an Arena after it finishes." />
          ) : (
            <Panel>
              {allocations.slice(0, 60).map((allocation) => (
                <div
                  key={allocation.id}
                  className="flex flex-col gap-1 border-b hairline px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/arenas/${allocation.arenaId}`}
                      className="font-mono text-[10px] uppercase tracking-widest text-bone-faint hover:text-bone"
                    >
                      {allocation.arenaName}
                    </Link>
                    <p className="truncate text-sm">
                      {allocation.finalRank ? `#${allocation.finalRank} ` : ''}
                      {allocation.projectName}
                      <span className="text-bone-faint"> · {allocation.label || allocation.rewardType}</span>
                    </p>
                    <p className="break-all font-mono text-[10px] text-bone-faint">
                      {allocation.builderEmail} · {allocation.walletAddress ?? 'no wallet'}
                      {allocation.claimTxHash ? ` · ${allocation.claimTxHash.slice(0, 14)}…` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="num text-sm">
                      {formatDisplayAmount(allocation.amount)} {allocation.tokenSymbol}
                    </span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-widest ${
                        allocation.status === 'claimed'
                          ? 'text-live'
                          : allocation.status === 'claimable'
                            ? 'text-gold'
                            : allocation.status === 'cancelled'
                              ? 'text-arena'
                              : 'text-bone-dim'
                      }`}
                    >
                      {allocation.status}
                    </span>
                  </div>
                </div>
              ))}
            </Panel>
          )}
        </div>
      </section>
    </Container>
  );
}

function PaymentTable({ rows }: { rows: Awaited<ReturnType<typeof listAdminTokenPayments>> }) {
  return (
    <Panel>
      {rows.map((payment) => (
        <div
          key={payment.id}
          className="flex flex-col gap-1 border-b hairline px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="num text-[11px] text-bone-faint">{formatDateTime(payment.createdAt)}</p>
            <Link
              href={`/admin/arenas/${payment.arenaId}`}
              className="text-sm hover:text-arena"
            >
              {payment.arenaName}
            </Link>
            <p className="text-xs text-bone-faint">{payment.projectName}</p>
            <p className="break-all font-mono text-[10px] text-bone-faint">
              {payment.walletAddress}
              {payment.txHash ? ` · ${payment.txHash}` : ''}
              {payment.failureReason ? ` · ${payment.failureReason}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="num text-sm">
              {formatDisplayAmount(payment.amountDisplay)} {payment.tokenSymbol}
            </span>
            <span
              className={`font-mono text-[10px] uppercase tracking-widest ${
                payment.status === 'confirmed'
                  ? 'text-live'
                  : ['failed', 'expired'].includes(payment.status)
                    ? 'text-arena'
                    : 'text-bone-dim'
              }`}
            >
              {payment.status}
            </span>
          </div>
        </div>
      ))}
    </Panel>
  );
}

function Metric({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="border-b border-r hairline px-4 py-4">
      <Label>{label}</Label>
      <p className="num mt-2 text-xl leading-none">
        {value}
        {suffix ? <span className="ml-1 text-[11px] text-bone-faint">{suffix}</span> : null}
      </p>
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className={`num mt-2 text-sm ${accent ? 'text-gold' : 'text-bone'}`}>{value}</p>
    </div>
  );
}
