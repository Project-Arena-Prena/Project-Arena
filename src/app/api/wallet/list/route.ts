import { NextResponse } from 'next/server';
import { getBuilder } from '@/lib/auth';
import { getBuilderWallets } from '@/services/wallet';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const wallets = await getBuilderWallets(ctx.builder.id);
  return NextResponse.json({
    wallets: wallets.map((wallet) => ({
      id: wallet.id,
      address: wallet.address,
      chainId: wallet.chainId,
      isPrimary: wallet.isPrimary,
      verifiedAt: wallet.verifiedAt,
    })),
  });
}
