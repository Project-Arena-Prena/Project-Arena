import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

/**
 * Entries only become real here — never on the client success redirect, which a
 * visitor can hit without paying.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');

  if (!stripe || !secret || !signature) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 400 });
  }

  const raw = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  const meta = session.metadata ?? {};

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ received: true, persisted: false });

  const admin = createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });

  const { error } = await admin.rpc('create_paid_entry', {
    p_arena_slug: meta.arena_slug ?? '',
    p_project_name: meta.project_name ?? '',
    p_project_url: meta.project_url ?? '',
    p_tagline: meta.project_tagline ?? '',
    p_category: meta.project_category ?? 'Experiment',
    p_description: meta.project_description ?? '',
    p_email: session.customer_email ?? '',
    p_stripe_session_id: session.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ received: true, persisted: true });
}
