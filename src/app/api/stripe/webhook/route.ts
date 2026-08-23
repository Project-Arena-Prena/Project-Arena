import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { isPaidCheckout, stripe } from '@/lib/stripe';
import { flushEmailOutbox } from '@/lib/notifications';

export const runtime = 'nodejs';

async function alreadyProcessed(id: string): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error('database_not_configured');
  const { data, error } = await supabase.from('stripe_events').select('id').eq('id', id).maybeSingle();
  if (error) throw new Error(`stripe_event_lookup_failed: ${error.message}`);
  return Boolean(data);
}

async function markProcessed(id: string, type: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error('database_not_configured');
  const { error } = await supabase.from('stripe_events').insert({ id, type });
  if (error && error.code !== '23505') throw new Error(`stripe_event_persist_failed: ${error.message}`);
}

async function fulfillCheckout(session: Stripe.Checkout.Session): Promise<void> {
  if (!isPaidCheckout(session)) return;
  const supabase = createAdminClient();
  if (!supabase) throw new Error('database_not_configured');
  const paymentId = session.metadata?.payment_id;
  if (!paymentId) throw new Error('missing_payment_metadata');
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, amount, currency, provider_checkout_id')
    .eq('id', paymentId)
    .maybeSingle();
  if (paymentError) throw new Error(`payment_lookup_failed: ${paymentError.message}`);
  if (!payment) throw new Error('payment_not_found');
  if (payment.provider_checkout_id && payment.provider_checkout_id !== session.id) {
    throw new Error('checkout_session_mismatch');
  }
  if (session.amount_total !== payment.amount || session.currency !== String(payment.currency).toLowerCase()) {
    throw new Error('checkout_amount_mismatch');
  }
  const paymentIntent =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
  const { error } = await supabase.rpc('confirm_paid_entry', {
    p_payment_id: paymentId,
    p_checkout_id: session.id,
    p_provider_payment_id: paymentIntent,
    p_receipt_url: null,
  });
  if (error) throw new Error(`entry_confirmation_failed: ${error.message}`);
}

async function failCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error('database_not_configured');
  const paymentId = session.metadata?.payment_id;
  if (!paymentId) throw new Error('missing_payment_metadata');
  const { error } = await supabase.rpc('fail_payment', { p_payment_id: paymentId, p_checkout_id: session.id });
  if (error) throw new Error(`payment_failure_update_failed: ${error.message}`);
}

async function refundByCharge(charge: Stripe.Charge): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error('database_not_configured');
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) return;
  const { data, error: lookupError } = await supabase
    .from('payments')
    .select('id')
    .eq('provider_payment_id', paymentIntent)
    .maybeSingle();
  if (lookupError) throw new Error(`payment_lookup_failed: ${lookupError.message}`);
  if (!data) return;
  const { error } = await supabase.rpc('mark_payment_refunded', {
    p_payment_id: data.id,
    p_reason: 'stripe_refund',
  });
  if (error) throw new Error(`refund_update_failed: ${error.message}`);
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');

  if (!stripe || !secret || !signature || !createAdminClient()) {
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
          const metadataPaymentId = intent.metadata?.payment_id;
          const query = supabase.from('payments').select('id');
          const { data, error: lookupError } = metadataPaymentId
            ? await query.eq('id', metadataPaymentId).maybeSingle()
            : await query.eq('provider_payment_id', intent.id).maybeSingle();
          if (lookupError) throw new Error(`payment_lookup_failed: ${lookupError.message}`);
          if (data) {
            const { error } = await supabase.rpc('fail_payment', { p_payment_id: data.id, p_checkout_id: null });
            if (error) throw new Error(`payment_failure_update_failed: ${error.message}`);
          }
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
