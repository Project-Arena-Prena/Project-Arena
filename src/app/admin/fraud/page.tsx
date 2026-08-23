import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { listFraudFlags } from '@/lib/admin-queries';
import { Container, Label, Panel, StatusBadge } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { FlagActions } from '@/components/admin/flag-actions';

export const metadata: Metadata = { title: 'Fraud flags' };

export default async function AdminFraudPage() {
  await requireAdmin('/admin/fraud');
  const flags = await listFraudFlags();
  return (
    <Container className="py-12">
      <Label>Fraud</Label>
      <h1 className="mt-3 text-4xl font-semibold tracking-headline">Flags</h1>
      <p className="mt-3 max-w-xl text-sm text-bone-dim">
        Basic spike and rate flags. Only valid events score. Inspect, don&apos;t overfit.
      </p>
      <Panel className="mt-8">
        {flags.map((flag) => (
          <div key={flag.id} className="flex flex-col gap-3 border-b hairline px-5 py-4 last:border-b-0 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm">
                {flag.projectName} · {flag.arenaName}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                {flag.eventType} · {flag.reason} · {flag.severity} · {formatDateTime(flag.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={flag.status === 'open' ? 'pending_review' : flag.status === 'confirmed' ? 'rejected' : 'approved'} />
              <FlagActions id={flag.id} />
            </div>
          </div>
        ))}
      </Panel>
    </Container>
  );
}
