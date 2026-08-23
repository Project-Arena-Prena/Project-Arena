import { NextResponse } from 'next/server';
import { z } from 'zod';
import { builderOwnsProject, getBuilder } from '@/lib/auth';
import { PROJECT_CATEGORIES } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase/server';
import { publicHttpUrl } from '@/lib/validation';

const Body = z.object({
  name: z.string().min(1).max(60).optional(),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  tagline: z.string().min(1).max(140).optional(),
  description: z.string().max(1200).optional(),
  websiteUrl: publicHttpUrl(300).optional(),
  category: z.enum(PROJECT_CATEGORIES as [string, ...string[]]).optional(),
  logoUrl: publicHttpUrl(500).optional().or(z.literal('')),
  xUrl: publicHttpUrl(300).optional().or(z.literal('')),
  githubUrl: publicHttpUrl(300).optional().or(z.literal('')),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const { projectId } = await params;
  if (!(await builderOwnsProject(ctx.builder.id, projectId)) && !ctx.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const patch: Record<string, unknown> = {};
  if (parsed.data.name) patch.name = parsed.data.name.trim();
  if (parsed.data.slug) patch.slug = parsed.data.slug;
  if (parsed.data.tagline) patch.tagline = parsed.data.tagline.trim();
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.websiteUrl) patch.website_url = parsed.data.websiteUrl;
  if (parsed.data.category) patch.category = parsed.data.category;
  if (parsed.data.logoUrl !== undefined) patch.logo_url = parsed.data.logoUrl || null;
  if (parsed.data.xUrl !== undefined) patch.x_url = parsed.data.xUrl || null;
  if (parsed.data.githubUrl !== undefined) patch.github_url = parsed.data.githubUrl || null;

  const { error } = await supabase.from('projects').update(patch).eq('id', projectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
