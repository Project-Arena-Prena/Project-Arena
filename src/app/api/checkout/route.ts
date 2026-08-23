import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { z } from 'zod';
import { getBuilder } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';
import { reconcileArenas } from '@/lib/arena-lifecycle';
import { getArena } from '@/lib/queries';
import { checkoutIntegrationId, siteUrl, stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';

const Body = z.object({
  arenaSlug: z.string().min(1).max(80),
  projectId: z.string().uuid(),
});

export async function POST(request: Request) {
  const stripeClient = stripe;
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.flatten() }, { status: 400 });
  }

  await reconcileArenas();
  const arena = await getArena(parsed.data.arenaSlug);
  if (!arena) return NextResponse.json({ error: 'arena_not_found' }, { status: 404 });
  if (arena.status === 'full') return NextResponse.json({ error: 'arena_full' }, { status: 409 });
  if (arena.status !== 'registration') return NextResponse.json({ error: 'arena_closed' }, { status: 409 });
  if (arena.entrantCount >= arena.entrantCap) {
    return NextResponse.json({ error: 'arena_full' }, { status: 409 });
  }
  if (arena.entryFeeCents > 0 && !stripeClient) {
    return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ url: `/enter/success?arena=${arena.slug}`, free: true });
  }

  const { data, error } = await supabase.rpc('start_checkout_entry', {
    p_arena_id: arena.id,
    p_project_id: parsed.data.projectId,
    p_builder_id: ctx.builder.id,
  });
  if (error) {
    const message = error.message ?? '';
    if (message.includes('arena_full')) return NextResponse.json({ error: 'arena_full' }, { status: 409 });
    if (message.includes('already_entered')) return NextResponse.json({ error: 'already_entered' }, { status: 409 });
    if (message.includes('not_project_owner')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    return NextResponse.json({ error: message || 'checkout_failed' }, { status: 500 });
  }

  const payload = data as { entry_id: string; payment_id: string; amount: number; arena_slug: string; arena_name: string };
  await trackEvent('arena_entry_started', {
    builderId: ctx.builder.id,
    arenaId: arena.id,
    projectId: parsed.data.projectId,
  });

  if (payload.amount === 0) {
    const { error: confirmationError } = await supabase.rpc('confirm_paid_entry', {
      p_payment_id: payload.payment_id,
      p_checkout_id: `free_${payload.payment_id}`,
      p_provider_payment_id: null,
      p_receipt_url: null,
    });
    if (confirmationError) {
      return NextResponse.json({ error: 'entry_confirmation_failed' }, { status: 500 });
    }
    return NextResponse.json({ url: `/enter/success?arena=${arena.slug}`, free: true });
  }
  if (!stripeClient) {
    return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 });
  }

  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', parsed.data.projectId)
    .maybeSingle();

  const session = await stripeClient.checkout.sessions.create({
    mode: 'payment',
    customer_email: ctx.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: payload.amount,
          product_data: {
            name: `${payload.arena_name} — entry`,
            description: `Entry for ${project?.name ?? 'Project'}`,
          },
        },
      },
    ],
    metadata: {
      payment_id: payload.payment_id,
      entry_id: payload.entry_id,
      arena_id: arena.id,
      project_id: parsed.data.projectId,
      builder_id: ctx.builder.id,
    },
    payment_intent_data: {
      metadata: {
        payment_id: payload.payment_id,
        entry_id: payload.entry_id,
        arena_id: arena.id,
        project_id: parsed.data.projectId,
        builder_id: ctx.builder.id,
      },
    },
    success_url: `${siteUrl()}/enter/success?arena=${arena.slug}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/enter?arena=${arena.slug}&canceled=1`,
    // Sandbox has Managed Payments on by default; that requires a product tax_code.
    // Keep tax off until a live registration exists. Money still does not buy rank.
    managed_payments: { enabled: false },
    integration_identifier: checkoutIntegrationId(),
  } as Parameters<Stripe['checkout']['sessions']['create']>[0]);

  await supabase
    .from('payments')
    .update({ provider_checkout_id: session.id })
    .eq('id', payload.payment_id);

  await trackEvent('checkout_started', {
    builderId: ctx.builder.id,
    arenaId: arena.id,
    projectId: parsed.data.projectId,
  });

  return NextResponse.json({ url: session.url });
}
