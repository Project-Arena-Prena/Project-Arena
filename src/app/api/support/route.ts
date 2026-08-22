import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({
  projectSlug: z.string().min(1).max(80),
  arenaSlug: z.string().min(1).max(80),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    // Fixture mode: accept the signal so the UI stays optimistic in local dev.
    return NextResponse.json({ ok: true, persisted: false });
  }

  const { error } = await supabase.rpc('record_support', {
    p_project_slug: parsed.data.projectSlug,
    p_arena_slug: parsed.data.arenaSlug,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
