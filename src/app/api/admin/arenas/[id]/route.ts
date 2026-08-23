import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder, userIsAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { reconcileArenas } from '@/lib/arena-lifecycle';

const Body = z.object({
  name: z.string().min(1).max(80).optional(),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  number: z.number().int().optional(),
  description: z.string().max(1200).optional(),
  category: z.string().min(1).max(40).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  registrationOpensAt: z.string().nullable().optional(),
  registrationClosesAt: z.string().nullable().optional(),
  maxEntries: z.number().int().positive().optional(),
  entryPrice: z.number().int().min(0).optional(),
  eligibilityText: z.string().max(2000).optional(),
  action: z
    .enum([
      'open_registration',
      'close_registration',
      'start',
      'end',
      'cancel',
      'duplicate',
      'go_live_now',
      'finish_now',
    ])
    .optional(),
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

  if (parsed.data.action === 'start') {
    await supabase.rpc('start_arena', { p_arena_id: id });
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === 'end') {
    await supabase.rpc('finalize_arena_by_id', { p_arena_id: id });
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === 'cancel') {
    await supabase.rpc('cancel_arena', { p_arena_id: id });
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === 'open_registration') {
    await supabase.from('arenas').update({ status: 'registration' }).eq('id', id);
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === 'close_registration') {
    await supabase.from('arenas').update({ status: 'full' }).eq('id', id);
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === 'go_live_now') {
    const now = new Date().toISOString();
    await supabase
      .from('arenas')
      .update({
        starts_at: new Date(Date.now() - 1000).toISOString(),
        registration_closes_at: now,
      })
      .eq('id', id);
    const { error } = await supabase.rpc('start_arena', { p_arena_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === 'finish_now') {
    await supabase.from('arenas').update({ ends_at: new Date(Date.now() - 1000).toISOString() }).eq('id', id);
    const { error } = await supabase.rpc('finalize_arena_by_id', { p_arena_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === 'duplicate') {
    const { data: source } = await supabase.from('arenas').select('*').eq('id', id).maybeSingle();
    if (!source) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const slug = `${source.slug}-copy`;
    const { data, error } = await supabase
      .from('arenas')
      .insert({
        name: `${source.name} (copy)`,
        slug,
        number: (source.number ?? 0) + 1,
        description: source.description,
        category: source.category,
        status: 'draft',
        starts_at: source.starts_at,
        ends_at: source.ends_at,
        registration_opens_at: source.registration_opens_at,
        registration_closes_at: source.registration_closes_at,
        max_entries: source.max_entries,
        entry_price: source.entry_price,
        eligibility_text: source.eligibility_text,
        scoring_config: source.scoring_config,
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.name) patch.name = parsed.data.name;
  if (parsed.data.slug) patch.slug = parsed.data.slug;
  if (parsed.data.number !== undefined) patch.number = parsed.data.number;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.category) patch.category = parsed.data.category;
  if (parsed.data.startsAt) patch.starts_at = parsed.data.startsAt;
  if (parsed.data.endsAt) patch.ends_at = parsed.data.endsAt;
  if (parsed.data.registrationOpensAt !== undefined) patch.registration_opens_at = parsed.data.registrationOpensAt;
  if (parsed.data.registrationClosesAt !== undefined) patch.registration_closes_at = parsed.data.registrationClosesAt;
  if (parsed.data.maxEntries) patch.max_entries = parsed.data.maxEntries;
  if (parsed.data.entryPrice !== undefined) patch.entry_price = parsed.data.entryPrice;
  if (parsed.data.eligibilityText !== undefined) patch.eligibility_text = parsed.data.eligibilityText;

  const { error } = await supabase.from('arenas').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await reconcileArenas(true);
  return NextResponse.json({ ok: true });
}
