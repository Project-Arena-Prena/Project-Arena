import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { isPaidCheckout, stripe } from '@/lib/stripe';
import { flushEmailOutbox } from '@/lib/notifications';

export const runtime = 'nodejs';

async function alreadyProcessed(id: string): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return false;
  const { data } = await supabase.from('stripe_events').select('id').eq('id', id).maybeSingle();
  return Boolean(data);
}

async function markProcessed(id: string, type: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.from('stripe_events').insert({ id, type }).then(() => undefined);
}

async function fulfillCheckout(session: Stripe.Checkout.Session): Promise<void> {
  if (!isPaidCheckout(session)) return;
  const supabase = createAdminClient();
  if (!supabase) return;
  const paymentId = session.metadata?.payment_id;
  if (!paymentId) return;
  const paymentIntent =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
  await supabase.rpc('confirm_paid_entry', {
    p_payment_id: paymentId,
    p_checkout_id: session.id,
    p_provider_payment_id: paymentIntent,
    p_receipt_url: session.invoice
      ? null
      : null,
  });
}

async function failCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  const paymentId = session.metadata?.payment_id;
  if (!paymentId) return;
  await supabase.rpc('fail_payment', { p_payment_id: paymentId, p_checkout_id: session.id });
}

async function refundByCharge(charge: Stripe.Charge): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) return;
  const { data } = await supabase
    .from('payments')
    .select('id')
    .eq('provider_payment_id', paymentIntent)
    .maybeSingle();
  if (!data) return;
  await supabase.rpc('mark_payment_refunded', {
    p_payment_id: data.id,
    p_reason: 'stripe_refund',
  });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');

  if (!stripe || !secret || !signature) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 400 });
  }

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await fulfillCheckout(event.data.object as Stripe.Checkout.Session);
        break;
      case 'checkout.session.async_payment_failed':
        await failCheckout(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const supabase = createAdminClient();
        if (supabase) {
          const { data } = await supabase
            .from('payments')
            .select('id')
            .eq('provider_payment_id', intent.id)
            .maybeSingle();
          if (data) await supabase.rpc('fail_payment', { p_payment_id: data.id, p_checkout_id: null });
        }
        break;
      }
      case 'charge.refunded':
        await refundByCharge(event.data.object as Stripe.Charge);
        break;
      default:
        break;
    }
    await markProcessed(event.id, event.type);
    await flushEmailOutbox().catch(() => undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'webhook_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true, persisted: true });
}
