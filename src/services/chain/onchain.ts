import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  erc20Abi,
  http,
  type PublicClient,
} from 'viem';
import { prenaServerConfig } from '@/lib/prena/config';
import { ChainError, type ChainProvider, type TokenBalance, type TokenTransferCheck } from './types';

/**
 * Real-chain provider. Selected when PRENA_MODE=onchain.
 *
 * Everything here treats chain data as untrusted input: a receipt is only
 * accepted after its status, chain id, token contract, recipient, and
 * confirmation depth have all been checked by the caller against the quote.
 */

let cachedClient: PublicClient | null = null;

function client(): PublicClient {
  if (cachedClient) return cachedClient;
  if (!prenaServerConfig.rpcUrl) throw new ChainError('not_configured', 'PRENA_RPC_URL is unset');
  const chain = defineChain({
    id: prenaServerConfig.chainId,
    name: process.env.NEXT_PUBLIC_PRENA_CHAIN_NAME ?? `chain-${prenaServerConfig.chainId}`,
    nativeCurrency: {
      name: process.env.NEXT_PUBLIC_PRENA_NATIVE_SYMBOL ?? 'ETH',
      symbol: process.env.NEXT_PUBLIC_PRENA_NATIVE_SYMBOL ?? 'ETH',
      decimals: 18,
    },
    rpcUrls: { default: { http: [prenaServerConfig.rpcUrl] } },
  });
  cachedClient = createPublicClient({ chain, transport: http(prenaServerConfig.rpcUrl) }) as PublicClient;
  return cachedClient;
}

export class OnchainProvider implements ChainProvider {
  readonly mode = 'onchain' as const;
  readonly chainId = prenaServerConfig.chainId;

  async getTokenBalance(walletAddress: string): Promise<TokenBalance> {
    const token = prenaServerConfig.tokenAddress;
    if (!token) throw new ChainError('not_configured', 'PRENA_TOKEN_ADDRESS is unset');
    try {
      const raw = await client().readContract({
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress as `0x${string}`],
      });
      return {
        raw: raw.toString(),
        decimals: prenaServerConfig.tokenDecimals,
        symbol: prenaServerConfig.tokenSymbol,
        chainId: this.chainId,
      };
    } catch {
      throw new ChainError('rpc_unavailable');
    }
  }

  async getTokenTransfer(txHash: string, expectedRecipient: string): Promise<TokenTransferCheck> {
    const token = prenaServerConfig.tokenAddress;
    if (!token) throw new ChainError('not_configured', 'PRENA_TOKEN_ADDRESS is unset');

    let receipt;
    let head: bigint;
    try {
      [receipt, head] = await Promise.all([
        client().getTransactionReceipt({ hash: txHash as `0x${string}` }),
        client().getBlockNumber(),
      ]);
    } catch {
      throw new ChainError('tx_not_found');
    }
    if (!receipt) throw new ChainError('tx_not_found');
    if (receipt.status !== 'success') throw new ChainError('tx_reverted');

    const confirmations = Number(head - receipt.blockNumber) + 1;
    if (confirmations < prenaServerConfig.minConfirmations) throw new ChainError('tx_pending');

    const recipient = expectedRecipient.toLowerCase();
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== token) continue;
      try {
        const decoded = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
        if (decoded.eventName !== 'Transfer') continue;
        const args = decoded.args as { from: string; to: string; value: bigint };
        if (args.to.toLowerCase() !== recipient) continue;
        return {
          from: args.from.toLowerCase(),
          to: args.to.toLowerCase(),
          amount: args.value.toString(),
          tokenContract: log.address.toLowerCase(),
          chainId: this.chainId,
          confirmations,
          success: true,
        };
      } catch {
        // Not an ERC-20 Transfer log; keep scanning.
      }
    }
    throw new ChainError('no_token_transfer');
  }

  async getUsdPricePerToken(): Promise<{ price: number; source: string }> {
    const url = prenaServerConfig.priceSourceUrl;
    if (!url) {
      // Deliberate hard failure: production must not fall back to a dev price.
      throw new ChainError('not_configured', 'PRENA_PRICE_SOURCE_URL is required in onchain mode');
    }
    try {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('bad_status');
      const payload = (await response.json()) as { usd?: number; price?: number };
      const price = Number(payload.usd ?? payload.price);
      if (!Number.isFinite(price) || price <= 0) throw new Error('bad_price');
      return { price, source: url };
    } catch {
      throw new ChainError('rpc_unavailable', 'price source unavailable');
    }
  }
}
