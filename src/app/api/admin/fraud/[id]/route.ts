import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder, userIsAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

const Body = z.object({
  status: z.enum(['open', 'reviewed', 'ignored', 'confirmed']),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getBuilder();
  if (!ctx || !(await userIsAdmin(ctx.userId, ctx.email))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const { error } = await supabase.from('fraud_flags').update({ status: parsed.data.status }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
