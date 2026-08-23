import { NextResponse } from 'next/server';
import { z } from 'zod';
import { trackEvent } from '@/lib/analytics';

const Body = z.object({
  name: z.string().min(1).max(80),
  arenaId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  visitorId: z.string().uuid().optional(),
  payload: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  await trackEvent(parsed.data.name, {
    arenaId: parsed.data.arenaId,
    projectId: parsed.data.projectId,
    visitorId: parsed.data.visitorId,
    payload: parsed.data.payload,
  });
  return NextResponse.json({ ok: true });
}
