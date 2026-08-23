import { createAdminClient } from '@/lib/supabase/server';
import { prenaServerConfig } from '@/lib/prena/config';
import { applyDiscountCents, formatTokenAmount, usdCentsToBaseUnits } from '@/lib/prena/amount';
import { chainProvider } from './chain';

/**
 * Arena pricing and token conversion are separate concerns. The database stores
 * entry_price (USD cents), prena_payment_enabled, and prena_discount_percent.
 * The token amount is minted here, at checkout time, from a trusted price
 * source — never from anything the browser sends.
 */

export interface PrenaQuote {
  id: string;
  usdAmount: number;
  usdAmountCents: number;
  discountPercent: number;
  discountedUsdAmount: number;
  discountedUsdCents: number;
  tokenAmount: string;
  tokenAmountFormatted: string;
  tokenSymbol: string;
  tokenContract: string | null;
  tokenDecimals: number;
  chainId: number;
  usdPricePerToken: number;
  priceSource: string;
  expiresAt: string;
  mode: 'mock' | 'onchain';
}

export type QuoteResult =
  | { ok: true; quote: PrenaQuote }
  | { ok: false; error: 'price_unavailable' | 'not_configured' | 'invalid_request' };

export interface QuoteRequest {
  usdAmount?: number;
  usdAmountCents?: number;
  discountPercent: number;
  builderId: string;
  arenaId: string;
  projectId?: string | null;
}

/**
 * Computes and persists an authoritative quote. Persisting matters: payment
 * verification later re-reads the stored token_amount, so an amount the browser
 * reports is never the amount that gets validated.
 */
export async function getPrenaQuote(request: QuoteRequest): Promise<QuoteResult> {
  const usdAmountCents =
    request.usdAmountCents ??
    (typeof request.usdAmount === 'number' ? Math.round(request.usdAmount * 100) : null);
  if (usdAmountCents == null || usdAmountCents < 0) return { ok: false, error: 'invalid_request' };

  const discountPercent = Math.min(90, Math.max(0, Math.round(request.discountPercent)));
  const discountedUsdCents = applyDiscountCents(usdAmountCents, discountPercent);

  let price: { price: number; source: string };
  try {
    price = await chainProvider().getUsdPricePerToken();
  } catch {
    return { ok: false, error: 'price_unavailable' };
  }
  if (!Number.isFinite(price.price) || price.price <= 0) return { ok: false, error: 'price_unavailable' };

  const decimals = prenaServerConfig.tokenDecimals;
  const tokenAmount = usdCentsToBaseUnits(discountedUsdCents, price.price, decimals).toString();

  const expiresAt = new Date(Date.now() + prenaServerConfig.quoteTtlSeconds * 1000).toISOString();

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const { data, error } = await supabase
    .from('prena_quotes')
    .insert({
      builder_id: request.builderId,
      arena_id: request.arenaId,
      project_id: request.projectId ?? null,
      usd_amount_cents: usdAmountCents,
      discount_percent: discountPercent,
      discounted_usd_cents: discountedUsdCents,
      token_symbol: prenaServerConfig.tokenSymbol,
      token_contract: prenaServerConfig.tokenAddress,
      chain_id: prenaServerConfig.chainId,
      token_decimals: decimals,
      token_amount: tokenAmount,
      usd_price_per_token: price.price,
      price_source: price.source,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: 'not_configured' };

  return {
    ok: true,
    quote: {
      id: String((data as { id: string }).id),
      usdAmount: usdAmountCents / 100,
      usdAmountCents,
      discountPercent,
      discountedUsdAmount: discountedUsdCents / 100,
      discountedUsdCents,
      tokenAmount,
      tokenAmountFormatted: formatTokenAmount(tokenAmount, decimals),
      tokenSymbol: prenaServerConfig.tokenSymbol,
      tokenContract: prenaServerConfig.tokenAddress,
      tokenDecimals: decimals,
      chainId: prenaServerConfig.chainId,
      usdPricePerToken: price.price,
      priceSource: price.source,
      expiresAt,
      mode: prenaServerConfig.mode,
    },
  };
}

/** Non-persisted estimate for display on public Arena pages. */
export async function estimatePrenaEntry(input: {
  usdAmountCents: number;
  discountPercent: number;
}): Promise<{ tokenAmount: string; formatted: string; discountedUsdCents: number } | null> {
  const discountedUsdCents = applyDiscountCents(input.usdAmountCents, input.discountPercent);
  try {
    const { price } = await chainProvider().getUsdPricePerToken();
    if (!Number.isFinite(price) || price <= 0) return null;
    const decimals = prenaServerConfig.tokenDecimals;
    const tokenAmount = usdCentsToBaseUnits(discountedUsdCents, price, decimals).toString();
    return { tokenAmount, formatted: formatTokenAmount(tokenAmount, decimals), discountedUsdCents };
  } catch {
    return null;
  }
}
