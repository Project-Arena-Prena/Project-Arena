import type { Metadata } from 'next';
import { requireBuilder } from '@/lib/auth';
import { getBuilderPayments } from '@/lib/builder-queries';
import { Container, EmptyState, Label, Panel, StatusBadge } from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/format';

export const metadata: Metadata = { title: 'Billing' };

export default async function BillingPage() {
  const ctx = await requireBuilder('/dashboard/billing');
  const payments = await getBuilderPayments(ctx.builder.id);

  return (
    <>
      <section className="border-b hairline">
        <Container className="py-10">
          <Label>Billing</Label>
          <h1 className="mt-4 text-4xl font-semibold tracking-headline">Payment history</h1>
          <p className="mt-3 max-w-xl text-sm text-bone-dim">
            Arena entries only. No subscriptions. Money buys participation, not rank.
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
                  <p className="num text-[11px] text-bone-faint">{formatDate(payment.createdAt)}</p>
                  <p className="mt-1 text-sm">{payment.arenaName}</p>
                  <p className="text-xs text-bone-faint">{payment.projectName}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="num text-sm">{formatMoney(payment.amount)}</span>
                  <StatusBadge status={payment.status} />
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
                </div>
              </div>
            ))}
          </Panel>
        )}
      </Container>
    </>
  );
}
