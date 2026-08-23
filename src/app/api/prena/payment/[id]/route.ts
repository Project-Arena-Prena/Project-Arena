import { NextResponse } from 'next/server';
import { getBuilder } from '@/lib/auth';
import { getTokenPayment } from '@/services/tokenPayment';
import { formatTokenAmount, tryParseBaseUnits } from '@/lib/prena/amount';

export const dynamic = 'force-dynamic';

/** Poll target so a token payment survives a refresh mid-transaction. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const { id } = await params;
  const row = await getTokenPayment(ctx.builder.id, id);
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const arena = (row.arenas ?? {}) as { name?: string; slug?: string };
  const entries = Array.isArray(row.arena_entries) ? (row.arena_entries as Array<{ id: string; status: string }>) : [];
  const decimals = Number(row.token_decimals ?? 18);
  const amount = (tryParseBaseUnits(row.token_amount) ?? 0n).toString();

  return NextResponse.json({
    id: String(row.id),
    status: String(row.status),
    txHash: (row.tx_hash as string | null) ?? null,
    failureReason: (row.failure_reason as string | null) ?? null,
    tokenAmount: amount,
    tokenAmountFormatted: formatTokenAmount(amount, decimals),
    tokenSymbol: String(row.token_symbol ?? 'PRENA'),
    tokenDecimals: decimals,
    tokenContract: (row.token_contract as string | null) ?? null,
    chainId: Number(row.chain_id ?? 0),
    recipientAddress: (row.recipient_address as string | null) ?? null,
    mode: String(row.mode ?? 'mock'),
    arenaName: arena.name ?? '',
    arenaSlug: arena.slug ?? '',
    entryId: entries[0]?.id ?? null,
    entryStatus: entries[0]?.status ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
  });
}
