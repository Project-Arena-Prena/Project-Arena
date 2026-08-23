/**
 * Blockchain abstraction. Everything the platform needs from a chain is behind
 * this interface, so mock mode and a real deployment are interchangeable and no
 * RPC call leaks into a React component.
 */

export interface TokenBalance {
  /** Base units, as a decimal string. */
  raw: string;
  decimals: number;
  symbol: string;
  chainId: number;
}

export interface TokenTransferCheck {
  /** Address that sent the tokens. */
  from: string;
  /** Address that received them. */
  to: string;
  /** Base units transferred to `to`. */
  amount: string;
  /** ERC-20 contract the transfer belongs to. */
  tokenContract: string | null;
  chainId: number;
  confirmations: number;
  /** Transaction receipt status. */
  success: boolean;
}

export type ChainReadError =
  | 'rpc_unavailable'
  | 'not_configured'
  | 'tx_not_found'
  | 'tx_pending'
  | 'tx_reverted'
  | 'no_token_transfer';

export class ChainError extends Error {
  constructor(public readonly code: ChainReadError, message?: string) {
    super(message ?? code);
    this.name = 'ChainError';
  }
}

export interface ChainProvider {
  readonly mode: 'mock' | 'onchain';
  readonly chainId: number;

  /** ERC-20 balance for a wallet. Throws ChainError on RPC failure. */
  getTokenBalance(walletAddress: string): Promise<TokenBalance>;

  /**
   * Resolves a transaction into the token transfer it performed. Returns the
   * transfer that credits `expectedRecipient`, or throws ChainError.
   */
  getTokenTransfer(txHash: string, expectedRecipient: string): Promise<TokenTransferCheck>;

  /** USD price per whole token, from a trusted source. */
  getUsdPricePerToken(): Promise<{ price: number; source: string }>;
}
