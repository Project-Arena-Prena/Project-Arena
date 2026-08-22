import { NextResponse } from 'next/server';
import { z } from 'zod';
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
    // Fixture mode: accept the signal so the UI stays optimistic in local dev.
    return NextResponse.json({ ok: true, duplicate: false, persisted: false });
  }

  const { data, error } = await supabase.rpc('record_support', {
    p_project_slug: parsed.data.projectSlug,
    p_arena_slug: parsed.data.arenaSlug,
    p_visitor_id: parsed.data.visitorId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { duplicate?: boolean } | null;
  return NextResponse.json({ ok: true, duplicate: result?.duplicate ?? false, persisted: true });
}
