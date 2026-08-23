import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { getAdminArena } from '@/lib/admin-queries';
import { Container, Label, StatusBadge } from '@/components/ui';
import { ArenaForm } from '@/components/admin/arena-form';
import { ArenaPrenaForm } from '@/components/admin/arena-prena-form';
import { formatDateTime, formatMoney } from '@/lib/format';
import { getArenaRewardPool, listArenaAllocations } from '@/services/rewards';
import { listArenaTokenPayments } from '@/lib/admin-queries';
import { prenaTokenDescriptor } from '@/services/token';
import { formatDisplayAmount } from '@/lib/prena/amount';

export const metadata: Metadata = { title: 'Edit Arena' };

export default async function AdminArenaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('/admin/arenas');
  const { id } = await params;
  const arena = await getAdminArena(id);
  if (!arena) notFound();

  const [pool, allocations, tokenPayments] = await Promise.all([
    getArenaRewardPool(arena.id),
    listArenaAllocations(arena.id),
    listArenaTokenPayments(arena.id),
  ]);
  const token = prenaTokenDescriptor();
  const prenaVolume = tokenPayments
    .filter((payment) => payment.status === 'confirmed')
    .reduce((sum, payment) => sum + Number(payment.amountDisplay), 0);

  return (
    <Container className="py-12">
      <div className="flex flex-wrap items-center gap-3">
        <Label>{arena.name}</Label>
        <StatusBadge status={arena.status} />
      </div>
      <h1 className="mt-3 text-4xl font-semibold tracking-headline">{arena.name}</h1>
      <p className="mt-3 num text-xs text-bone-faint">
        {arena.entrantCount} / {arena.entrantCap} · {formatMoney(arena.entryFeeCents)} · Starts{' '}
        {formatDateTime(arena.startsAt)} · Ends {formatDateTime(arena.endsAt)}
      </p>
      <div className="mt-10 max-w-2xl">
        <ArenaForm arena={arena} />
      </div>

      <div className="mt-12 max-w-4xl">
        <ArenaPrenaForm arena={arena} pool={pool} tokenConfig={token} />
      </div>

      <div className="mt-12 max-w-4xl">
        <Label>$PRENA in this Arena</Label>
        <div className="mt-4 grid grid-cols-2 border hairline md:grid-cols-4">
          <Cell label="Entry volume" value={`${formatDisplayAmount(prenaVolume)} ${token.symbol}`} />
          <Cell label="Token payments" value={String(tokenPayments.filter((p) => p.status === 'confirmed').length)} />
          <Cell
            label="Pending / failed"
            value={String(tokenPayments.filter((p) => ['pending', 'confirming', 'failed', 'expired'].includes(p.status)).length)}
          />
          <Cell label="Allocations" value={String(allocations.length)} />
        </div>

        {tokenPayments.length > 0 ? (
          <div className="mt-6 border hairline">
            {tokenPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-col gap-1 border-b hairline px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="num text-[11px] text-bone-faint">{formatDateTime(payment.createdAt)}</p>
                  <p className="truncate text-sm">{payment.projectName}</p>
                  <p className="break-all font-mono text-[10px] text-bone-faint">
                    {payment.walletAddress}
                    {payment.txHash ? ` · ${payment.txHash.slice(0, 14)}…` : ''}
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
          </div>
        ) : null}

        {allocations.length > 0 ? (
          <div className="mt-8">
            <Label>Reward allocations</Label>
            <div className="mt-4 border hairline">
              {allocations.map((allocation) => (
                <div
                  key={allocation.id}
                  className="flex flex-col gap-1 border-b hairline px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm">
                      {allocation.finalRank ? `#${allocation.finalRank} ` : ''}
                      {allocation.projectName}
                    </p>
                    <p className="break-all font-mono text-[10px] text-bone-faint">
                      {allocation.label} · {allocation.walletAddress ?? 'no wallet linked'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="num text-sm">
                      {allocation.amountFormatted} {allocation.tokenSymbol}
                    </span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-widest ${
                        allocation.status === 'claimed'
                          ? 'text-live'
                          : allocation.status === 'claimable'
                            ? 'text-gold'
                            : 'text-bone-dim'
                      }`}
                    >
                      {allocation.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Container>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r hairline px-4 py-4 last:border-r-0">
      <Label>{label}</Label>
      <p className="num mt-2 text-lg">{value}</p>
    </div>
  );
}
