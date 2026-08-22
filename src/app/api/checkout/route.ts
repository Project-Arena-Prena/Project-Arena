import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe, siteUrl } from '@/lib/stripe';
import { getArena } from '@/lib/queries';
import { createAdminClient } from '@/lib/supabase/server';
import { PROJECT_CATEGORIES } from '@/lib/types';

const Body = z.object({
  arenaSlug: z.string().min(1).max(80),
  projectName: z.string().min(1).max(60),
  tagline: z.string().min(1).max(140),
  url: z.string().url().max(300),
  category: z.enum(PROJECT_CATEGORIES as [string, ...string[]]),
  description: z.string().max(1200).optional(),
  logoName: z.string().max(180).optional(),
  xUrl: z.string().url().max(300).optional(),
  githubUrl: z.string().url().max(300).optional(),
  builderEmail: z.string().email().max(200),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.flatten() }, { status: 400 });
  }

  const arena = await getArena(parsed.data.arenaSlug);
  if (!arena) return NextResponse.json({ error: 'arena_not_found' }, { status: 404 });
  if (arena.status === 'finished') return NextResponse.json({ error: 'arena_ended' }, { status: 409 });
  if (arena.entrantCount >= arena.entrantCap) {
    return NextResponse.json({ error: 'arena_full' }, { status: 409 });
  }

  if (!stripe || arena.entryFeeCents === 0) {
    // Free Arena, or Stripe not configured locally: skip Checkout. The paid path
    // persists in the webhook, so a free entry has to be written here instead.
    const supabase = createAdminClient();
    if (supabase && arena.entryFeeCents === 0) {
      const { error } = await supabase.rpc('create_paid_entry', {
        p_arena_slug: arena.slug,
        p_project_name: parsed.data.projectName,
        p_project_url: parsed.data.url,
        p_tagline: parsed.data.tagline,
        p_category: parsed.data.category,
        p_description: parsed.data.description ?? '',
        p_logo_url: '',
        p_x_url: parsed.data.xUrl ?? '',
        p_github_url: parsed.data.githubUrl ?? '',
        p_email: parsed.data.builderEmail,
        p_stripe_session_id: `free_${arena.slug}_${parsed.data.url}`,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ url: `/enter/success?arena=${arena.slug}`, free: true });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: parsed.data.builderEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: arena.entryFeeCents,
          product_data: {
            name: `${arena.name} — entry`,
            description: `Entry for ${parsed.data.projectName}`,
          },
        },
      },
    ],
    metadata: {
      arena_slug: arena.slug,
      project_name: parsed.data.projectName,
      project_url: parsed.data.url,
      project_tagline: parsed.data.tagline,
      project_category: parsed.data.category,
      project_description: parsed.data.description ?? '',
      project_x_url: parsed.data.xUrl ?? '',
      project_github_url: parsed.data.githubUrl ?? '',
    },
    success_url: `${siteUrl()}/enter/success?arena=${arena.slug}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/enter?arena=${arena.slug}&canceled=1`,
  });

  return NextResponse.json({ url: session.url });
}
