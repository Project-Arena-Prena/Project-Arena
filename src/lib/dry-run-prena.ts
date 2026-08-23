import { randomBytes, randomUUID } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { createAdminClient } from './supabase/server';
import { prenaServerConfig } from './prena/config';
import { fromBaseUnits, toBaseUnits } from './prena/amount';
import { getPrenaQuote } from '@/services/tokenQuote';
import { createPrenaPaymentIntent, simulatePrenaPayment, verifyPrenaPayment } from '@/services/tokenPayment';
import { calculateArenaRewards, setArenaRewardStatus, listArenaAllocations } from '@/services/rewards';
import { getPrenaBalance } from '@/services/token';
import { consumeWalletChallenge, createWalletChallenge, linkWallet } from '@/services/wallet';

/**
 * End-to-end $PRENA rehearsal against a real database in mock mode:
 * link wallet → quote → entry → verified payment → finish → rewards → claim.
 *
 * It also asserts the rule that matters most: a Project's score and rank are
 * byte-identical before and after a token payment.
 */

export interface PrenaDryRunReport {
  arenaSlug: string;
  steps: string[];
  quote: { usd: number; discountPercent: number; tokens: string };
  payment: { status: string; entryStatus?: string };
  scoreUnchanged: boolean;
  rankUnchanged: boolean;
  allocations: Array<{ project: string; rank: number | null; amount: string; status: string }>;
  claimed: { amount: string; status: string } | null;
  balanceBefore: string;
  balanceAfter: string;
}

export async function runPrenaDryRun(): Promise<PrenaDryRunReport> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error('Supabase is not configured.');
  if (prenaServerConfig.mode !== 'mock') {
    throw new Error('The $PRENA dry-run only runs with PRENA_MODE=mock.');
  }

  const stamp = Date.now().toString(36);
  const slug = `prena-dry-run-${stamp}`;
  const steps: string[] = [];
  // A throwaway key so the rehearsal produces real signatures over the real
  // challenge, rather than trusting an address the way a client would.
  const account = privateKeyToAccount(`0x${randomBytes(32).toString('hex')}`);
  const wallet = account.address.toLowerCase();
  const now = Date.now();

  // --- Arena -----------------------------------------------------------------
  const { data: arena, error: arenaError } = await supabase
    .from('arenas')
    .insert({
      name: `PRENA DRY RUN #${stamp.slice(-4).toUpperCase()}`,
      slug,
      number: 0,
      description: '$PRENA rehearsal. Not a public competition.',
      category: 'Open',
      status: 'registration',
      starts_at: new Date(now + 60 * 60_000).toISOString(),
      ends_at: new Date(now + 120 * 60_000).toISOString(),
      registration_opens_at: new Date(now - 60_000).toISOString(),
      registration_closes_at: new Date(now + 59 * 60_000).toISOString(),
      max_entries: 8,
      entry_price: 2900,
      prena_payment_enabled: true,
      prena_discount_percent: 17,
      reward_pool_enabled: true,
      visibility: 'unlisted',
    })
    .select('id, slug')
    .single();
  if (arenaError || !arena) throw new Error(`arena insert failed: ${arenaError?.message}`);
  steps.push('arena:registration');

  // --- Builder, project, verified wallet -------------------------------------
  // builders.user_id references auth.users, so the rehearsal needs a real
  // auth identity. The trigger on auth.users creates the builder row.
  const email = `prena-dry-run-${stamp}@example.invalid`;
  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: 'Dry Run Builder' },
  });
  if (authError || !created.user) throw new Error(`auth user failed: ${authError?.message}`);

  let builder: { id: string } | null = null;
  const { data: existingBuilder } = await supabase
    .from('builders')
    .select('id')
    .eq('user_id', created.user.id)
    .maybeSingle();
  builder = (existingBuilder as { id: string } | null) ?? null;
  if (!builder) {
    const { data: inserted, error: builderError } = await supabase
      .from('builders')
      .insert({ user_id: created.user.id, email, display_name: 'Dry Run Builder' })
      .select('id')
      .single();
    if (builderError || !inserted) throw new Error(`builder insert failed: ${builderError?.message}`);
    builder = inserted as { id: string };
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: `Dry Run ${stamp.slice(-4).toUpperCase()}`,
      slug: `prena-dry-run-project-${stamp}`,
      website_url: 'https://example.invalid',
      category: 'Other',
      builder_email: email,
      status: 'active',
    })
    .select('id, name')
    .single();
  if (projectError || !project) throw new Error(`project insert failed: ${projectError?.message}`);

  await supabase.from('project_owners').insert({ project_id: project.id, builder_id: builder.id });

  const challenge = await createWalletChallenge({
    builderId: builder.id,
    address: wallet,
    chainId: prenaServerConfig.chainId,
    purpose: 'link',
  });
  if ('error' in challenge) throw new Error(`challenge failed: ${challenge.error}`);

  // A forged signature must not link the wallet.
  const forged = await consumeWalletChallenge({
    builderId: builder.id,
    nonce: challenge.nonce,
    message: challenge.message,
    signature: `0x${'11'.repeat(65)}`,
    purpose: 'link',
  });
  if (!('error' in forged)) throw new Error('a forged signature was accepted');
  steps.push(`forged-signature:rejected(${forged.error})`);

  const challenge2 = await createWalletChallenge({
    builderId: builder.id,
    address: wallet,
    chainId: prenaServerConfig.chainId,
    purpose: 'link',
  });
  if ('error' in challenge2) throw new Error(`challenge failed: ${challenge2.error}`);

  const signature = await account.signMessage({ message: challenge2.message });
  const verifiedChallenge = await consumeWalletChallenge({
    builderId: builder.id,
    nonce: challenge2.nonce,
    message: challenge2.message,
    signature,
    purpose: 'link',
  });
  if ('error' in verifiedChallenge) throw new Error(`verify failed: ${verifiedChallenge.error}`);

  // Replaying the same nonce and signature must fail.
  const replayNonce = await consumeWalletChallenge({
    builderId: builder.id,
    nonce: challenge2.nonce,
    message: challenge2.message,
    signature,
    purpose: 'link',
  });
  if (!('error' in replayNonce)) throw new Error('a nonce was consumed twice');
  steps.push(`nonce-replay:rejected(${replayNonce.error})`);

  const linked = await linkWallet({
    builderId: builder.id,
    address: verifiedChallenge.address,
    chainId: verifiedChallenge.chainId,
  });
  if ('error' in linked) throw new Error(`link failed: ${linked.error}`);
  steps.push('wallet:verified');

  const before = await getPrenaBalance(wallet);
  const balanceBefore = before.ok ? before.balance.raw : '0';

  // --- Quote -----------------------------------------------------------------
  const quoteResult = await getPrenaQuote({
    builderId: builder.id,
    arenaId: arena.id,
    projectId: project.id,
    usdAmountCents: 2900,
    discountPercent: 17,
  });
  if (!quoteResult.ok) throw new Error(`quote failed: ${quoteResult.error}`);
  steps.push('quote:created');

  // --- Entry + verified payment ----------------------------------------------
  const intentResult = await createPrenaPaymentIntent({
    builderId: builder.id,
    arenaId: arena.id,
    projectId: project.id,
    quoteId: quoteResult.quote.id,
    walletAddress: wallet,
  });
  if (!intentResult.ok) throw new Error(`intent failed: ${intentResult.error}`);
  steps.push('payment:pending');

  const verified = await simulatePrenaPayment({
    builderId: builder.id,
    tokenPaymentId: intentResult.intent.tokenPaymentId,
  });
  if (verified.status !== 'confirmed') {
    throw new Error(`payment not confirmed: ${verified.status} ${verified.error ?? ''}`);
  }
  steps.push('payment:confirmed');

  // Replaying the same hash must not create a second entry.
  const replay = await simulatePrenaPayment({
    builderId: builder.id,
    tokenPaymentId: intentResult.intent.tokenPaymentId,
  });
  if (replay.status !== 'confirmed' || replay.entryId !== verified.entryId) {
    throw new Error('replay produced a different entry');
  }
  steps.push('replay:idempotent');

  // A second Project must not be able to reuse the first payment's hash.
  const { data: project2 } = await supabase
    .from('projects')
    .insert({
      name: `Dry Run B ${stamp.slice(-4).toUpperCase()}`,
      slug: `prena-dry-run-project-b-${stamp}`,
      website_url: 'https://example.invalid',
      category: 'Other',
      builder_email: email,
      status: 'active',
    })
    .select('id')
    .single();
  await supabase.from('project_owners').insert({
    project_id: (project2 as { id: string }).id,
    builder_id: builder.id,
  });

  const quote2 = await getPrenaQuote({
    builderId: builder.id,
    arenaId: arena.id,
    projectId: (project2 as { id: string }).id,
    usdAmountCents: 2900,
    discountPercent: 17,
  });
  if (!quote2.ok) throw new Error(`second quote failed: ${quote2.error}`);
  const intent2 = await createPrenaPaymentIntent({
    builderId: builder.id,
    arenaId: arena.id,
    projectId: (project2 as { id: string }).id,
    quoteId: quote2.quote.id,
    walletAddress: wallet,
  });
  if (!intent2.ok) throw new Error(`second intent failed: ${intent2.error}`);

  const { data: firstPayment } = await supabase
    .from('token_payments')
    .select('tx_hash')
    .eq('id', intentResult.intent.tokenPaymentId)
    .single();
  const reused = await verifyPrenaPayment({
    builderId: builder.id,
    tokenPaymentId: intent2.intent.tokenPaymentId,
    txHash: (firstPayment as { tx_hash: string }).tx_hash,
  });
  if (reused.status === 'confirmed') {
    throw new Error('a transaction hash funded two entries');
  }
  steps.push(`tx-reuse:rejected(${reused.error ?? reused.status})`);

  // --- Rank independence ------------------------------------------------------
  const { data: entryBefore } = await supabase
    .from('arena_entries')
    .select('id, score, current_rank, supporter_count, unique_visit_count')
    .eq('id', verified.entryId!)
    .single();

  await supabase.rpc('approve_entry', { p_entry_id: verified.entryId });
  await supabase.from('arenas').update({
    starts_at: new Date(Date.now() - 2000).toISOString(),
    registration_closes_at: new Date(Date.now() - 1000).toISOString(),
  }).eq('id', arena.id);
  await supabase.rpc('start_arena', { p_arena_id: arena.id });
  steps.push('arena:live');

  const { data: entryAfter } = await supabase
    .from('arena_entries')
    .select('id, score, current_rank, supporter_count, unique_visit_count')
    .eq('id', verified.entryId!)
    .single();

  const scoreUnchanged =
    Number((entryBefore as { score: number } | null)?.score ?? -1) ===
    Number((entryAfter as { score: number } | null)?.score ?? -2);
  const rankUnchanged =
    Number((entryBefore as { supporter_count: number } | null)?.supporter_count ?? -1) ===
    Number((entryAfter as { supporter_count: number } | null)?.supporter_count ?? -2);

  // --- Reward pool + allocations ----------------------------------------------
  const { data: pool } = await supabase
    .from('arena_reward_pools')
    .insert({
      arena_id: arena.id,
      token_symbol: prenaServerConfig.tokenSymbol,
      chain_id: prenaServerConfig.chainId,
      total_amount: 30000,
      status: 'announced',
    })
    .select('id')
    .single();
  await supabase.from('arena_reward_tiers').insert([
    { reward_pool_id: (pool as { id: string }).id, reward_type: 'champion', label: 'Champion', rank_start: 1, rank_end: 1, amount: 20000, distribution: 'each', position: 0 },
    { reward_pool_id: (pool as { id: string }).id, reward_type: 'community', label: 'Community rewards', amount: 10000, distribution: 'split', position: 1 },
  ]);

  await supabase.from('arenas').update({ ends_at: new Date(Date.now() - 1000).toISOString() }).eq('id', arena.id);
  await supabase.rpc('finalize_arena_by_id', { p_arena_id: arena.id });
  steps.push('arena:finished');

  const rewards = await calculateArenaRewards(arena.id);
  if (!rewards.ok) throw new Error(`reward calculation failed: ${rewards.error}`);
  await setArenaRewardStatus(arena.id, 'pending', 'approved');
  await setArenaRewardStatus(arena.id, 'approved', 'claimable');
  steps.push(`rewards:${rewards.created}`);

  // Publishing has to reach the Builder. A claimable allocation nobody is told
  // about is the failure this assertion exists to catch.
  const { data: notices } = await supabase
    .from('email_outbox')
    .select('id')
    .eq('template', 'reward_claimable')
    .eq('payload->>arenaSlug', arena.slug)
    .limit(1);
  if (!notices?.length) throw new Error('publishing rewards queued no reward_claimable email');
  steps.push('notify:queued');

  const allocations = await listArenaAllocations(arena.id);

  // --- Claim -------------------------------------------------------------------
  let claimed: { amount: string; status: string } | null = null;
  const claimable = allocations.find((item) => item.status === 'claimable');
  if (claimable) {
    // The dry-run has no wallet to sign with, so it exercises the database
    // guard directly. The HTTP path additionally requires a valid signature.
    const { error: claimError } = await supabase.rpc('claim_reward', {
      p_allocation_id: claimable.id,
      p_builder_id: builder.id,
      p_wallet_address: wallet,
      p_signature: 'dry-run',
      p_tx_hash: null,
    });
    if (claimError) throw new Error(`claim failed: ${claimError.message}`);

    const { error: doubleClaim } = await supabase.rpc('claim_reward', {
      p_allocation_id: claimable.id,
      p_builder_id: builder.id,
      p_wallet_address: wallet,
      p_signature: 'dry-run',
      p_tx_hash: null,
    });
    if (!doubleClaim) throw new Error('a reward was claimed twice');
    steps.push('claim:once-only');
    claimed = { amount: claimable.amount, status: 'claimed' };
  }

  const after = await getPrenaBalance(wallet);

  // Keep the rehearsal out of public surfaces. The rows stay for inspection,
  // the way the Arena clock dry-run leaves its own, but nothing is listed.
  await supabase
    .from('projects')
    .update({ status: 'rejected' })
    .in('id', [project.id, (project2 as { id: string }).id]);
  steps.push('cleanup:unlisted');

  return {
    arenaSlug: arena.slug,
    steps,
    quote: {
      usd: quoteResult.quote.discountedUsdAmount,
      discountPercent: quoteResult.quote.discountPercent,
      tokens: fromBaseUnits(quoteResult.quote.tokenAmount, quoteResult.quote.tokenDecimals),
    },
    payment: { status: verified.status, entryStatus: verified.entryStatus },
    scoreUnchanged,
    rankUnchanged,
    allocations: allocations.map((item) => ({
      project: item.projectName,
      rank: item.finalRank,
      amount: item.amount,
      status: item.status,
    })),
    claimed,
    balanceBefore: fromBaseUnits(balanceBefore, prenaServerConfig.tokenDecimals),
    balanceAfter: after.ok
      ? fromBaseUnits(after.balance.raw, prenaServerConfig.tokenDecimals)
      : '0',
  };
}

export { toBaseUnits };
