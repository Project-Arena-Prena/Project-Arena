import { NextResponse } from 'next/server';
import { reconcileArenas } from '@/lib/arena-lifecycle';
import { expireStaleTokenPayments, generatePendingArenaRewards } from '@/services/prenaOps';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization');
  if (secret && header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  await reconcileArenas(true);
  // $PRENA maintenance never blocks Arena reconciliation.
  const [expired, rewards] = await Promise.all([
    expireStaleTokenPayments().catch(() => 0),
    generatePendingArenaRewards().catch(() => ({ arenas: 0, created: 0 })),
  ]);
  return NextResponse.json({ ok: true, expiredTokenPayments: expired, rewards });
}

export async function POST(request: Request) {
  return GET(request);
}
