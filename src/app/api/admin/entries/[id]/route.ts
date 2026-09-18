import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder, userIsAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

const Body = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(400).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getBuilder();
  if (!ctx || !(await userIsAdmin(ctx.userId, ctx.email))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  if (parsed.data.action === 'approve') {
    const { data: entry } = await supabase
      .from('arena_entries')
      .select('arena_id, status')
      .eq('id', id)
      .maybeSingle();
    if (entry) {
      const { data: arena } = await supabase
        .from('arenas')
        .select('slug')
        .eq('id', entry.arena_id)
        .maybeSingle();
      if (arena?.slug === 'founding') {
        const { count, error: countError } = await supabase
          .from('arena_entries')
          .select('id', { count: 'exact', head: true })
          .eq('arena_id', entry.arena_id)
          .in('status', ['approved', 'competing', 'finished'])
          .eq('free_entry', true);
        if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
        if ((count ?? 0) >= 10) {
          return NextResponse.json({ error: 'free_slots_full' }, { status: 409 });
        }
      }
    }

    const { error } = await supabase.rpc('approve_entry', { p_entry_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.rpc('reject_entry', {
    p_entry_id: id,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
