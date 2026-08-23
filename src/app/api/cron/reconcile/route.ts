import { NextResponse } from 'next/server';
import { reconcileArenas } from '@/lib/arena-lifecycle';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization');
  if (secret && header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  await reconcileArenas(true);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  return GET(request);
}
