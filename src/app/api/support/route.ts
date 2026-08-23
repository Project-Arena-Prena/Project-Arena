import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIp, hashSignal, trackEvent } from '@/lib/analytics';
import { createAdminClient } from '@/lib/supabase/server';

const Body = z.object({
  projectSlug: z.string().min(1).max(80),
  arenaSlug: z.string().min(1).max(80),
  visitorId: z.string().uuid(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, duplicate: false, persisted: false });
  }

  const { data, error } = await supabase.rpc('record_support', {
    p_project_slug: parsed.data.projectSlug,
    p_arena_slug: parsed.data.arenaSlug,
    p_visitor_id: parsed.data.visitorId,
    p_ip_hash: hashSignal(clientIp(request)),
    p_ua_hash: hashSignal(request.headers.get('user-agent')),
    p_session_id: hashSignal(request.headers.get('cookie')),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { duplicate?: boolean; valid?: boolean } | null;
  if (!result?.duplicate) {
    await trackEvent('project_supported', { visitorId: parsed.data.visitorId });
  }
  return NextResponse.json({
    ok: true,
    duplicate: result?.duplicate ?? false,
    valid: result?.valid ?? true,
    persisted: true,
  });
}
