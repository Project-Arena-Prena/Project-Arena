import { chainProvider, ChainError } from './chain';
import { prenaServerConfig } from '@/lib/prena/config';
import { formatTokenAmount } from '@/lib/prena/amount';

/** Token reads. The only path the product uses to learn a $PRENA balance. */

export interface PrenaBalance {
  address: string;
  raw: string;
  formatted: string;
  decimals: number;
  symbol: string;
  chainId: number;
  mode: 'mock' | 'onchain';
}

export type PrenaBalanceResult =
  | { ok: true; balance: PrenaBalance }
  | { ok: false; error: 'rpc_unavailable' | 'not_configured' | 'invalid_address' };

export async function getPrenaBalance(walletAddress: string): Promise<PrenaBalanceResult> {
  if (!/^0x[0-9a-f]{40}$/.test(walletAddress)) return { ok: false, error: 'invalid_address' };
  const provider = chainProvider();
  try {
    const balance = await provider.getTokenBalance(walletAddress);
    return {
      ok: true,
      balance: {
        address: walletAddress,
        raw: balance.raw,
        formatted: formatTokenAmount(balance.raw, balance.decimals),
        decimals: balance.decimals,
        symbol: balance.symbol,
        chainId: balance.chainId,
        mode: provider.mode,
      },
    };
  } catch (error) {
    if (error instanceof ChainError && error.code === 'not_configured') {
      return { ok: false, error: 'not_configured' };
    }
    return { ok: false, error: 'rpc_unavailable' };
  }
}

export function prenaTokenDescriptor() {
  return {
    symbol: prenaServerConfig.tokenSymbol,
    contract: prenaServerConfig.tokenAddress,
    chainId: prenaServerConfig.chainId,
    decimals: prenaServerConfig.tokenDecimals,
    mode: prenaServerConfig.mode,
  };
}
