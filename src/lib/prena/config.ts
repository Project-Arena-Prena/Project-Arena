/**
 * Central $PRENA configuration. Every chain-specific value lives here and comes
 * from the environment — no contract address, chain id, or treasury is ever
 * hard-coded in application code.
 *
 * PRENA_MODE=mock    development / pre-deployment. Balances, quotes, payments,
 *                    and claims are simulated but flow through the identical
 *                    service interfaces and database tables.
 * PRENA_MODE=onchain production. Requires a deployed token, an RPC endpoint,
 *                    a treasury address, and a trusted price source.
 */

export type PrenaMode = 'mock' | 'onchain';

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalize(address: string | undefined): string | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(lower) ? lower : null;
}

/** Chain id used when nothing is configured. 31337 = local dev chain. */
const DEV_CHAIN_ID = 31337;

/** Values safe to ship to the browser. */
export const prenaPublicConfig = {
  mode: (process.env.NEXT_PUBLIC_PRENA_MODE === 'onchain' ? 'onchain' : 'mock') as PrenaMode,
  chainId: int(process.env.NEXT_PUBLIC_PRENA_CHAIN_ID, DEV_CHAIN_ID),
  chainName: process.env.NEXT_PUBLIC_PRENA_CHAIN_NAME ?? 'Arena Devnet',
  nativeSymbol: process.env.NEXT_PUBLIC_PRENA_NATIVE_SYMBOL ?? 'ETH',
  rpcUrl: process.env.NEXT_PUBLIC_PRENA_RPC_URL ?? '',
  explorerUrl: (process.env.NEXT_PUBLIC_PRENA_EXPLORER_URL ?? '').replace(/\/$/, ''),
  tokenAddress: normalize(process.env.NEXT_PUBLIC_PRENA_TOKEN_ADDRESS),
  tokenSymbol: process.env.NEXT_PUBLIC_PRENA_TOKEN_SYMBOL ?? 'PRENA',
  tokenDecimals: int(process.env.NEXT_PUBLIC_PRENA_TOKEN_DECIMALS, 18),
} as const;

export type PrenaPublicConfig = typeof prenaPublicConfig;

/** Server-only configuration. Never import this from a client component. */
export const prenaServerConfig = {
  mode: ((env('PRENA_MODE') ?? prenaPublicConfig.mode) === 'onchain' ? 'onchain' : 'mock') as PrenaMode,
  chainId: int(env('PRENA_CHAIN_ID'), prenaPublicConfig.chainId),
  tokenAddress: normalize(env('PRENA_TOKEN_ADDRESS')) ?? prenaPublicConfig.tokenAddress,
  tokenSymbol: env('PRENA_TOKEN_SYMBOL') ?? prenaPublicConfig.tokenSymbol,
  tokenDecimals: int(env('PRENA_TOKEN_DECIMALS'), prenaPublicConfig.tokenDecimals),
  treasuryAddress: normalize(env('PRENA_TREASURY_ADDRESS')),
  rewardDistributorAddress: normalize(env('PRENA_REWARD_DISTRIBUTOR_ADDRESS')),
  rpcUrl: env('PRENA_RPC_URL') ?? prenaPublicConfig.rpcUrl,
  /** Quote lifetime. Short by design — a stale quote must not be spendable. */
  quoteTtlSeconds: int(env('PRENA_QUOTE_TTL_SECONDS'), 180),
  minConfirmations: int(env('PRENA_MIN_CONFIRMATIONS'), 1),
  /**
   * Development-only USD price per $PRENA. Ignored in onchain mode, which
   * requires PRENA_PRICE_SOURCE_URL. There is no browser-supplied price path.
   */
  devUsdPrice: Number(env('PRENA_DEV_USD_PRICE') ?? '0.01'),
  priceSourceUrl: env('PRENA_PRICE_SOURCE_URL') ?? null,
} as const;

export const isPrenaMock = prenaServerConfig.mode === 'mock';

/**
 * True when the token layer can actually run. Mock mode is always ready;
 * onchain mode needs a token, a treasury, an RPC, and a price source.
 */
export function prenaIsConfigured(): boolean {
  if (isPrenaMock) return true;
  return Boolean(
    prenaServerConfig.tokenAddress &&
      prenaServerConfig.treasuryAddress &&
      prenaServerConfig.rpcUrl &&
      prenaServerConfig.priceSourceUrl,
  );
}

/** Human-readable list of what onchain mode is still missing. */
export function prenaConfigGaps(): string[] {
  if (isPrenaMock) return [];
  const gaps: string[] = [];
  if (!prenaServerConfig.tokenAddress) gaps.push('PRENA_TOKEN_ADDRESS');
  if (!prenaServerConfig.treasuryAddress) gaps.push('PRENA_TREASURY_ADDRESS');
  if (!prenaServerConfig.rpcUrl) gaps.push('PRENA_RPC_URL');
  if (!prenaServerConfig.priceSourceUrl) gaps.push('PRENA_PRICE_SOURCE_URL');
  return gaps;
}

export function explorerTxUrl(hash: string | null | undefined): string | null {
  if (!hash || !prenaPublicConfig.explorerUrl) return null;
  return `${prenaPublicConfig.explorerUrl}/tx/${hash}`;
}

export function normalizeAddress(address: string | null | undefined): string | null {
  return normalize(address ?? undefined);
}

export function isAddressLike(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function isTxHashLike(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

/** 0x71...A92F — the display form used across the product. */
export function shortAddress(address: string | null | undefined): string {
  if (!address || address.length < 10) return '';
  return `${address.slice(0, 4)}…${address.slice(-4).toUpperCase()}`;
}
