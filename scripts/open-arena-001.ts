import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function loadEnv() {
  const path = join(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function iso(date: Date): string {
  return date.toISOString();
}

function nextMonday(from: Date): Date {
  const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 16, 0, 0));
  const day = date.getUTCDay();
  const add = day === 1 ? (from.getTime() > date.getTime() ? 7 : 0) : (8 - day) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + add);
  if (date.getTime() - from.getTime() < 7 * 24 * 60 * 60 * 1000) {
    date.setUTCDate(date.getUTCDate() + 7);
  }
  return date;
}

async function testCard(stripe: Stripe): Promise<string> {
  const method = await stripe.paymentMethods.create({
    type: 'card',
    card: { token: 'tok_visa' },
  });
  return method.id;
}

async function payCheckout(stripe: Stripe, sessionId: string): Promise<string> {
  const paymentMethod = await testCard(stripe);
  try {
    const paid = (await stripe.rawRequest('POST', `/v1/payment_pages/${sessionId}/confirm`, {
      payment_method: paymentMethod,
    })) as { payment_status?: string };
    return `payment_pages:${paid.payment_status ?? 'ok'}`;
  } catch (pagesError) {
    const pagesMessage = pagesError instanceof Error ? pagesError.message : String(pagesError);
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] });
    const intent =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
    if (intent) {
      await stripe.paymentIntents.confirm(intent, { payment_method: paymentMethod, off_session: true });
      return `payment_intent:${intent}`;
    }
    const customer = await stripe.customers.create({
      payment_method: paymentMethod,
      invoice_settings: { default_payment_method: paymentMethod },
    });
    const pi = await stripe.paymentIntents.create({
      amount: session.amount_total ?? 2900,
      currency: session.currency ?? 'usd',
      customer: customer.id,
      payment_method: paymentMethod,
      confirm: true,
      off_session: true,
      metadata: session.metadata ?? {},
    });
    if (pi.status !== 'succeeded') throw new Error(`PI ${pi.status}; payment_pages: ${pagesMessage}`);
    // Fulfill through the same webhook the hosted Checkout would send.
    await fulfillViaWebhook(stripe, session, pi);
    return `direct_pi_webhook:${pi.id}`;
  }
}

async function fulfillViaWebhook(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  pi: Stripe.PaymentIntent,
) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET missing');
  const payload = JSON.stringify({
    id: `evt_arena001_${pi.id}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        ...session,
        payment_status: 'paid',
        status: 'complete',
        payment_intent: pi.id,
      },
    },
  });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const response = await fetch('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': header, 'content-type': 'application/json' },
    body: payload,
  });
  if (!response.ok) {
    throw new Error(`webhook ${response.status} ${await response.text()}`);
  }
}

async function waitFor(label: string, fn: () => Promise<boolean>, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!url || !secret) throw new Error('Supabase is not configured');
  if (!stripeKey?.startsWith('sk_test_') && !stripeKey?.startsWith('rk_test_')) {
    throw new Error('Refusing to run Arena #001 against a live Stripe key');
  }

  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const stripe = new Stripe(stripeKey!);

  const now = new Date();
  const starts = nextMonday(now);
  const ends = new Date(starts.getTime() + 48 * 60 * 60 * 1000);

  const { data: existing } = await supabase.from('arenas').select('id, slug, status').eq('slug', 'open-arena-001').maybeSingle();
  let arenaId = existing?.id as string | undefined;
  if (!arenaId) {
    const { data, error } = await supabase
      .from('arenas')
      .insert({
        name: 'Open Arena #001',
        slug: 'open-arena-001',
        number: 1,
        description: 'The first paid Arena. Open category. Money buys a slot, not a rank.',
        category: 'Open',
        status: 'registration',
        visibility: 'public',
        starts_at: iso(starts),
        ends_at: iso(ends),
        registration_opens_at: iso(now),
        registration_closes_at: iso(starts),
        max_entries: 16,
        entry_price: 2900,
        eligibility_text: 'Any internet project with a public URL.',
      })
      .select('id, slug')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'failed to create Arena #001');
    arenaId = data.id;
    console.log('created', data.slug, data.id);
  } else {
    console.log('exists', existing?.slug, existing?.status, arenaId);
  }

  const field = [
    {
      email: 'signaldeck.arena001@projectarena.test',
      name: 'Signaldeck',
      slug: 'signaldeck',
      tagline: 'Turn launch noise into a signal.',
      url: 'https://signaldeck.example',
      category: 'SaaS' as const,
    },
    {
      email: 'quorumlist.arena001@projectarena.test',
      name: 'Quorumlist',
      slug: 'quorumlist',
      tagline: 'Lists that actually reach a quorum.',
      url: 'https://quorumlist.example',
      category: 'Developer' as const,
    },
  ];

  for (const row of field) {
    let userId: string | undefined;
    const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = users?.users.find((u) => u.email?.toLowerCase() === row.email);
    if (found) userId = found.id;
    else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: row.email,
        email_confirm: true,
        password: `Arena001!${Math.random().toString(36).slice(2, 10)}`,
        user_metadata: { display_name: row.name },
      });
      if (error || !data.user) throw new Error(error?.message ?? `failed to create ${row.email}`);
      userId = data.user.id;
    }

    await waitFor(`builder ${row.email}`, async () => {
      const { data } = await supabase.from('builders').select('id').eq('user_id', userId!).maybeSingle();
      return Boolean(data);
    });
    const { data: builder } = await supabase.from('builders').select('id, email').eq('user_id', userId!).single();
    if (!builder) throw new Error(`builder missing for ${row.email}`);

    let { data: project } = await supabase.from('projects').select('id, slug').eq('slug', row.slug).maybeSingle();
    if (!project) {
      const created = await supabase
        .from('projects')
        .insert({
          name: row.name,
          slug: row.slug,
          tagline: row.tagline,
          description: `${row.name} enters Open Arena #001.`,
          website_url: row.url,
          category: row.category,
          builder_email: row.email,
          status: 'active',
          arena_rating: 1000,
        })
        .select('id, slug')
        .single();
      if (created.error || !created.data) throw new Error(created.error?.message ?? `failed to create ${row.slug}`);
      project = created.data;
    }
    await supabase.from('project_owners').upsert(
      { project_id: project.id, builder_id: builder.id, role: 'owner' },
      { onConflict: 'project_id,builder_id' },
    );

    const { data: liveEntry } = await supabase
      .from('arena_entries')
      .select('id, status, payment_id')
      .eq('arena_id', arenaId)
      .eq('project_id', project.id)
      .in('status', ['pending_payment', 'pending_review', 'approved', 'competing'])
      .maybeSingle();

    if (liveEntry?.status === 'pending_review' || liveEntry?.status === 'approved' || liveEntry?.status === 'competing') {
      if (liveEntry.status === 'pending_review') {
        const { error } = await supabase.rpc('approve_entry', { p_entry_id: liveEntry.id });
        if (error) throw new Error(error.message);
        console.log(row.slug, 'approved existing');
      } else {
        console.log(row.slug, 'already', liveEntry.status);
      }
      continue;
    }

    let payload: { entry_id: string; payment_id: string; amount: number; arena_name: string };
    if (liveEntry?.status === 'pending_payment' && liveEntry.payment_id) {
      payload = {
        entry_id: liveEntry.id,
        payment_id: liveEntry.payment_id as string,
        amount: 2900,
        arena_name: 'Open Arena #001',
      };
    } else {
      const checkout = await supabase.rpc('start_checkout_entry', {
        p_arena_id: arenaId,
        p_project_id: project.id,
        p_builder_id: builder.id,
      });
      if (checkout.error || !checkout.data) throw new Error(checkout.error?.message ?? 'start_checkout_entry failed');
      payload = checkout.data as { entry_id: string; payment_id: string; amount: number; arena_name: string };
    }
    if (payload.amount !== 2900) throw new Error(`expected 2900 cents, got ${payload.amount}`);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: row.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: payload.amount,
            product_data: {
              name: `${payload.arena_name} — entry`,
              description: `Entry for ${row.name}`,
            },
          },
        },
      ],
      metadata: {
        payment_id: payload.payment_id,
        entry_id: payload.entry_id,
        arena_id: arenaId!,
        project_id: project.id,
        builder_id: builder.id,
      },
      success_url: 'http://localhost:3000/enter/success?arena=open-arena-001&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:3000/enter?arena=open-arena-001&canceled=1',
      managed_payments: { enabled: false },
      integration_identifier: `arena-entry-${Math.random().toString(16).slice(2, 10)}`,
    } as Parameters<Stripe['checkout']['sessions']['create']>[0]);

    await supabase.from('payments').update({ provider_checkout_id: session.id }).eq('id', payload.payment_id);
    console.log(row.slug, 'checkout', session.id, '$' + payload.amount / 100);

    const how = await payCheckout(stripe, session.id);
    console.log(row.slug, 'paid via', how);

    await waitFor(`${row.slug} pending_review`, async () => {
      const { data } = await supabase.from('arena_entries').select('status').eq('id', payload.entry_id).maybeSingle();
      return data?.status === 'pending_review';
    }, 25_000);

    const { error: approveError } = await supabase.rpc('approve_entry', { p_entry_id: payload.entry_id });
    if (approveError) throw new Error(approveError.message);
    console.log(row.slug, 'approved');
  }

  const { data: arena } = await supabase
    .from('arenas')
    .select('name, slug, status, max_entries, entry_price, starts_at, ends_at')
    .eq('id', arenaId!)
    .single();
  const { data: entries } = await supabase
    .from('arena_entries')
    .select('status, projects(name, slug)')
    .eq('arena_id', arenaId!);

  console.log('arena', arena);
  console.log(
    'entries',
    (entries ?? []).map((row) => ({
      status: row.status,
      project: (row.projects as { name?: string; slug?: string } | null)?.slug,
    })),
  );
  console.log('starts', arena?.starts_at, 'ends', arena?.ends_at);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
