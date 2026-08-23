import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder, userIsAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

const Body = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  number: z.number().int(),
  description: z.string().max(1200).optional(),
  category: z.string().min(1).max(40),
  startsAt: z.string(),
  endsAt: z.string(),
  registrationOpensAt: z.string().optional(),
  registrationClosesAt: z.string().optional(),
  maxEntries: z.number().int().positive(),
  entryPrice: z.number().int().min(0),
  eligibilityText: z.string().max(2000).optional(),
  status: z.enum(['draft', 'registration', 'full', 'live', 'finished', 'cancelled']).optional(),
  duplicateFrom: z.string().uuid().optional(),
});

async function requireAdminUser() {
  const ctx = await getBuilder();
  if (!ctx || !(await userIsAdmin(ctx.userId, ctx.email))) return null;
  return ctx;
}

export async function POST(request: Request) {
  const ctx = await requireAdminUser();
  if (!ctx) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  let scoring = undefined;
  if (parsed.data.duplicateFrom) {
    const { data: source } = await supabase
      .from('arenas')
      .select('scoring_config, eligibility_text, category, max_entries, entry_price')
      .eq('id', parsed.data.duplicateFrom)
      .maybeSingle();
    scoring = source?.scoring_config;
  }

  const { data, error } = await supabase
    .from('arenas')
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      number: parsed.data.number,
      description: parsed.data.description ?? '',
      category: parsed.data.category,
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
      registration_opens_at: parsed.data.registrationOpensAt ?? null,
      registration_closes_at: parsed.data.registrationClosesAt ?? parsed.data.startsAt,
      max_entries: parsed.data.maxEntries,
      entry_price: parsed.data.entryPrice,
      eligibility_text: parsed.data.eligibilityText ?? '',
      status: parsed.data.status ?? 'draft',
      scoring_config: scoring,
    })
    .select('id, slug')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
