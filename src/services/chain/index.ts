import { prenaServerConfig } from '@/lib/prena/config';
import { MockChainProvider } from './mock';
import { OnchainProvider } from './onchain';
import type { ChainProvider } from './types';

let provider: ChainProvider | null = null;

/**
 * The single place the mock/onchain decision is made. Callers depend on
 * ChainProvider only, so swapping in the real deployment is an env change.
 */
export function chainProvider(): ChainProvider {
  if (!provider) {
    provider = prenaServerConfig.mode === 'onchain' ? new OnchainProvider() : new MockChainProvider();
  }
  return provider;
}

export * from './types';
export { mockTxHash } from './mock';
