import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder } from '@/lib/auth';
import { PROJECT_CATEGORIES } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase/server';

const Body = z.object({
  name: z.string().min(1).max(60),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  tagline: z.string().min(1).max(140),
  description: z.string().max(1200).optional(),
  websiteUrl: z.string().url().max(300),
  category: z.enum(PROJECT_CATEGORIES as [string, ...string[]]),
  logoUrl: z.string().url().max(500).optional().or(z.literal('')),
  xUrl: z.string().url().max(300).optional().or(z.literal('')),
  githubUrl: z.string().url().max(300).optional().or(z.literal('')),
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export async function POST(request: Request) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  let slug = parsed.data.slug || slugify(parsed.data.name);
  const { data: clash } = await supabase.from('projects').select('id').eq('slug', slug).maybeSingle();
  if (clash) slug = `${slug}-${ctx.builder.id.slice(0, 5)}`;

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name: parsed.data.name.trim(),
      slug,
      tagline: parsed.data.tagline.trim(),
      description: parsed.data.description?.trim() ?? '',
      website_url: parsed.data.websiteUrl,
      category: parsed.data.category,
      logo_url: parsed.data.logoUrl || null,
      x_url: parsed.data.xUrl || null,
      github_url: parsed.data.githubUrl || null,
      builder_email: ctx.email.toLowerCase(),
      status: 'active',
      arena_rating: 1000,
    })
    .select('id, slug')
    .single();

  if (error || !project) {
    return NextResponse.json({ error: error?.message ?? 'create_failed' }, { status: 500 });
  }

  await supabase.from('project_owners').insert({
    project_id: project.id,
    builder_id: ctx.builder.id,
    role: 'owner',
  });

  return NextResponse.json({ id: project.id, slug: project.slug });
}
