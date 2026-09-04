import { formatDisplayAmount } from './prena/amount';
import { siteUrl } from './stripe';
import { createAdminClient } from './supabase/server';

export type EmailTemplate =
  | 'entry_payment_received'
  | 'entry_approved'
  | 'arena_starting'
  | 'arena_finished'
  | 'reward_claimable';

interface Mail {
  id?: string;
  template: EmailTemplate;
  to: string;
  payload: Record<string, unknown>;
}

interface DeliveryResult {
  status: 'sent' | 'mocked' | 'failed';
  error: string | null;
}

function deliveryConfig(): { key: string; from: string; replyTo?: string } | null {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || from.includes('@localhost')) return null;
  const replyTo = process.env.EMAIL_REPLY_TO;
  return { key, from, ...(replyTo ? { replyTo } : {}) };
}

function subjectFor(mail: Mail): string {
  const arena = String(mail.payload.arenaName ?? 'an Arena');
  const project = String(mail.payload.projectName ?? 'Your Project');
  switch (mail.template) {
    case 'entry_payment_received':
      return `Payment received for ${arena}`;
    case 'entry_approved':
      return `${project} has been approved for ${arena}`;
    case 'arena_starting':
      return `${arena} is now live`;
    case 'arena_finished':
      return `${project} finished in ${arena}`;
    case 'reward_claimable':
      return `Your ${arena} reward is ready to claim`;
  }
}

function bodyFor(mail: Mail): string {
  const arena = String(mail.payload.arenaName ?? 'the Arena');
  const project = String(mail.payload.projectName ?? 'Your Project');
  const rank = mail.payload.rank;
  const amount = formatDisplayAmount(String(mail.payload.amount ?? '0'));
  const symbol = String(mail.payload.tokenSymbol ?? 'PRENA');
  const label = String(mail.payload.rewardLabel ?? 'Reward');
  switch (mail.template) {
    case 'entry_payment_received':
      return `Payment received for ${arena}. Your Project is pending review.`;
    case 'entry_approved':
      return `${project} has been approved for ${arena}.`;
    case 'arena_starting':
      return `${arena} is now live.`;
    case 'arena_finished':
      return rank
        ? `${project} finished #${rank} in ${arena}. View your results.`
        : `${arena} has finished. View your results.`;
    case 'reward_claimable':
      return `${project} earned ${amount} ${symbol} in ${arena} (${label}). Earned through Project Arena. Claim Reward: ${siteUrl()}/dashboard/prena`;
  }
}

async function deliver(mail: Mail): Promise<DeliveryResult> {
  const config = deliveryConfig();
  if (!config) {
    if (process.env.NODE_ENV === 'production') {
      return { status: 'failed', error: 'email_delivery_not_configured' };
    }
    console.info('[email:mock]', subjectFor(mail), '→', mail.to, bodyFor(mail));
    return { status: 'mocked', error: null };
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        ...(mail.id ? { 'Idempotency-Key': `arena-email-${mail.id}` } : {}),
      },
      body: JSON.stringify({
        from: config.from,
        to: mail.to,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
        subject: subjectFor(mail),
        text: bodyFor(mail),
      }),
    });
    return response.ok
      ? { status: 'sent', error: null }
      : { status: 'failed', error: `resend_http_${response.status}` };
  } catch {
    return { status: 'failed', error: 'resend_request_failed' };
  }
}

export async function flushEmailOutbox(limit = 20): Promise<number> {
  // Preserve queued production mail until a provider is configured. This also
  // prevents recipient addresses and message bodies from reaching runtime logs.
  if (process.env.NODE_ENV === 'production' && !deliveryConfig()) return 0;

  const supabase = createAdminClient();
  if (!supabase) return 0;
  const { data } = await supabase
    .from('email_outbox')
    .select('id, template, to_email, payload')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (!data?.length) return 0;

  let sent = 0;
  for (const row of data) {
    const result = await deliver({
      id: row.id as string,
      template: row.template as EmailTemplate,
      to: row.to_email as string,
      payload: (row.payload ?? {}) as Record<string, unknown>,
    });
    await supabase
      .from('email_outbox')
      .update({
        status: result.status,
        sent_at: result.status === 'failed' ? null : new Date().toISOString(),
        error: result.error,
      })
      .eq('id', row.id);
    if (result.status !== 'failed') sent += 1;
  }
  return sent;
}

export async function queueEmail(mail: Mail): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) {
    await deliver(mail);
    return;
  }
  await supabase.from('email_outbox').insert({
    template: mail.template,
    to_email: mail.to.toLowerCase(),
    payload: mail.payload,
    status: 'queued',
  });
  await flushEmailOutbox();
}

