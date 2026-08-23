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
  template: EmailTemplate;
  to: string;
  payload: Record<string, unknown>;
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

async function deliver(mail: Mail): Promise<'sent' | 'mocked' | 'failed'> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'Project Arena <arena@localhost>';
  if (!key) {
    console.info('[email:mock]', subjectFor(mail), '→', mail.to, bodyFor(mail));
    return 'mocked';
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: mail.to,
        subject: subjectFor(mail),
        text: bodyFor(mail),
      }),
    });
    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

export async function flushEmailOutbox(limit = 20): Promise<number> {
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
    const status = await deliver({
      template: row.template as EmailTemplate,
      to: row.to_email as string,
      payload: (row.payload ?? {}) as Record<string, unknown>,
    });
    await supabase
      .from('email_outbox')
      .update({
        status,
        sent_at: status === 'failed' ? null : new Date().toISOString(),
        error: status === 'failed' ? 'delivery_failed' : null,
      })
      .eq('id', row.id);
    if (status !== 'failed') sent += 1;
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
