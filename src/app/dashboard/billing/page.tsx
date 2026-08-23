import type { Metadata } from 'next';
import { requireBuilder } from '@/lib/auth';
import { getBuilderEntryPayments } from '@/lib/builder-queries';
import { Container, EmptyState, Label, Panel, StatusBadge } from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/format';
import { formatDisplayAmount } from '@/lib/prena/amount';
import { explorerTxUrl } from '@/lib/prena/config';

export const metadata: Metadata = { title: 'Billing' };

export default async function BillingPage() {
  const ctx = await requireBuilder('/dashboard/billing');
  const payments = await getBuilderEntryPayments(ctx.builder.id);

  return (
    <>
      <section className="border-b hairline">
        <Container className="py-10">
          <Label>Billing</Label>
          <h1 className="mt-4 text-4xl font-semibold tracking-headline">Payment history</h1>
          <p className="mt-3 max-w-xl text-sm text-bone-dim">
            Arena entries only, on either rail. No subscriptions. Paying buys participation, not rank.
          </p>
        </Container>
      </section>
      <Container className="pt-10">
        {payments.length === 0 ? (
          <EmptyState title="No payments yet" hint="When you enter a paid Arena, the receipt lands here." />
        ) : (
          <Panel>
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-col gap-3 border-b hairline px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="num text-[11px] text-bone-faint">
                    {formatDate(payment.createdAt)}
                    <span className="mx-2 text-bone-faint/50">/</span>
                    {payment.rail === 'prena' ? '$PRENA' : 'Card'}
                  </p>
                  <p className="mt-1 text-sm">{payment.arenaName}</p>
                  <p className="text-xs text-bone-faint">{payment.projectName}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="num text-sm">
                    {payment.rail === 'prena'
                      ? `${formatDisplayAmount(payment.tokenAmountDisplay ?? '0')} ${payment.tokenSymbol}`
                      : formatMoney(payment.amountCents ?? 0)}
                  </span>
                  <StatusBadge status={payment.status as Parameters<typeof StatusBadge>[0]['status']} />
                  {payment.receiptUrl ? (
                    <a
                      href={payment.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] uppercase tracking-widest text-bone-dim hover:text-bone"
                    >
                      Receipt
                    </a>
                  ) : null}
                  {explorerTxUrl(payment.txHash) ? (
                    <a
                      href={explorerTxUrl(payment.txHash) as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] uppercase tracking-widest text-bone-dim hover:text-bone"
                    >
                      Tx
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </Panel>
        )}
      </Container>
    </>
  );
}
