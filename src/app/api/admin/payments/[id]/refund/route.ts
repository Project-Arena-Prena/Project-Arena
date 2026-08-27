import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuilder, userIsAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

const Body = z.object({
  reason: z.string().min(1).max(200),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getBuilder();
  if (!ctx || !(await userIsAdmin(ctx.userId, ctx.email))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => ({ reason: 'administrative exception' })));
  const reason = parsed.success ? parsed.data.reason : 'administrative exception';

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const { data: payment } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
  if (!payment) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!['paid', 'overflow'].includes(payment.status)) {
    return NextResponse.json({ error: 'not_refundable' }, { status: 409 });
  }

  if (!stripe || !payment.provider_payment_id) {
    return NextResponse.json({ error: 'stripe_refund_not_configured' }, { status: 503 });
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: payment.provider_payment_id,
      reason: 'requested_by_customer',
      metadata: { payment_id: id, reason },
    }, {
      idempotencyKey: `arena-refund-${id}`,
    });

    // Stripe can hold a refund in a pending state. Let the signed webhook make
    // the database authoritative only once money has actually been returned.
    if (refund.status !== 'succeeded') {
      return NextResponse.json({ ok: false, status: refund.status ?? 'pending' }, { status: 202 });
    }
  } catch {
    return NextResponse.json({ error: 'stripe_refund_failed' }, { status: 502 });
  }

  await supabase.rpc('mark_payment_refunded', { p_payment_id: id, p_reason: reason });
  return NextResponse.json({ ok: true });
}
