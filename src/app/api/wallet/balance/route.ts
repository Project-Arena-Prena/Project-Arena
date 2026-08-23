import { NextResponse } from 'next/server';
import { getBuilder } from '@/lib/auth';
import { getPrenaBalance } from '@/services/token';
import { getBuilderWallets } from '@/services/wallet';
import { normalizeAddress } from '@/lib/prena/config';

export const dynamic = 'force-dynamic';

/**
 * Balances are read server-side so no RPC endpoint or provider key is exposed
 * to the browser, and so mock mode can consult the simulated ledger.
 */
export async function GET(request: Request) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const requested = normalizeAddress(new URL(request.url).searchParams.get('address'));
  const wallets = await getBuilderWallets(ctx.builder.id);
  const wallet = requested
    ? wallets.find((item) => item.address === requested && item.verifiedAt)
    : wallets.find((item) => item.verifiedAt);

  if (!wallet) return NextResponse.json({ error: 'wallet_not_linked' }, { status: 404 });

  const result = await getPrenaBalance(wallet.address);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'rpc_unavailable' ? 503 : 400 });
  }
  return NextResponse.json({ balance: result.balance });
}
