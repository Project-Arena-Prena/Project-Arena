import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { listAdminPayments } from '@/lib/admin-queries';
import { Container, Label, Panel, StatusBadge } from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/format';
import { RefundButton } from '@/components/admin/refund-button';

export const metadata: Metadata = { title: 'Admin Payments' };

export default async function AdminPaymentsPage() {
  await requireAdmin('/admin/payments');
  const payments = await listAdminPayments();
  return (
    <Container className="py-12">
      <Label>Payments</Label>
      <h1 className="mt-3 text-4xl font-semibold tracking-headline">Ledger</h1>
      <Panel className="mt-8">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex flex-col gap-3 border-b hairline px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="num text-[11px] text-bone-faint">{formatDate(payment.createdAt)}</p>
              <p className="text-sm">{payment.arenaName}</p>
              <p className="text-xs text-bone-faint">{payment.projectName}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="num text-sm">{formatMoney(payment.amount)}</span>
              <StatusBadge status={payment.status} />
              {['paid', 'overflow'].includes(payment.status) ? <RefundButton id={payment.id} /> : null}
            </div>
          </div>
        ))}
      </Panel>
    </Container>
  );
}
