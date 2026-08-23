import { createHash } from 'node:crypto';
import { prenaServerConfig } from '@/lib/prena/config';
import { toBaseUnits, tryParseBaseUnits } from '@/lib/prena/amount';
import { createAdminClient } from '@/lib/supabase/server';
import { ChainError, type ChainProvider, type TokenBalance, type TokenTransferCheck } from './types';

/**
 * DEVELOPMENT ONLY. Simulates the chain so the entire $PRENA flow — balance,
 * quote, payment, confirmation, reward, claim — is exercisable before the token
 * is deployed. It is selected only when PRENA_MODE=mock.
 *
 * PRODUCTION MUST NOT RUN THIS. Every simulated balance and transaction is
 * labelled `mock` in the database and in the UI.
 */

/** Deterministic starting balance so a wallet looks the same on every refresh. */
function seededOpeningBalance(walletAddress: string): bigint {
  const digest = createHash('sha256').update(`prena-mock:${walletAddress}`).digest();
  const whole = 4000 + (digest.readUInt32BE(0) % 46_000); // 4,000 – 49,999
  return toBaseUnits(whole, prenaServerConfig.tokenDecimals);
}

/** A stable synthetic hash so mock transactions still look like transactions. */
export function mockTxHash(seed: string): string {
  return `0x${createHash('sha256').update(`prena-mock-tx:${seed}`).digest('hex')}`;
}

export class MockChainProvider implements ChainProvider {
  readonly mode = 'mock' as const;
  readonly chainId = prenaServerConfig.chainId;

  /**
   * Opening balance minus confirmed entry spend plus claimed rewards, so the
   * simulated ledger survives a refresh exactly like a real one would.
   */
  async getTokenBalance(walletAddress: string): Promise<TokenBalance> {
    const decimals = prenaServerConfig.tokenDecimals;
    let balance = seededOpeningBalance(walletAddress);

    const supabase = createAdminClient();
    if (supabase) {
      const [{ data: spent }, { data: claimed }] = await Promise.all([
        supabase
          .from('token_payments')
          .select('token_amount')
          .eq('wallet_address', walletAddress)
          .eq('status', 'confirmed'),
        supabase
          .from('reward_allocations')
          .select('amount')
          .eq('wallet_address', walletAddress)
          .eq('status', 'claimed'),
      ]);
      for (const row of spent ?? []) {
        balance -= tryParseBaseUnits((row as { token_amount: string }).token_amount) ?? 0n;
      }
      for (const row of claimed ?? []) {
        balance += toBaseUnits(String((row as { amount: string }).amount ?? '0'), decimals);
      }
    }

    return {
      raw: (balance > 0n ? balance : 0n).toString(),
      decimals,
      symbol: prenaServerConfig.tokenSymbol,
      chainId: this.chainId,
    };
  }

  /**
   * Mock transfers are looked up in token_payments rather than invented, so a
   * hash the platform never issued still fails verification.
   */
  async getTokenTransfer(txHash: string, expectedRecipient: string): Promise<TokenTransferCheck> {
    const supabase = createAdminClient();
    if (!supabase) throw new ChainError('not_configured');

    const { data } = await supabase
      .from('token_payments')
      .select('wallet_address, recipient_address, token_amount, token_contract, chain_id')
      .eq('tx_hash', txHash.toLowerCase())
      .maybeSingle();

    if (!data) throw new ChainError('tx_not_found');
    const row = data as {
      wallet_address: string;
      recipient_address: string | null;
      token_amount: string;
      token_contract: string | null;
      chain_id: number;
    };

    return {
      from: row.wallet_address,
      to: (row.recipient_address ?? expectedRecipient).toLowerCase(),
      amount: (tryParseBaseUnits(row.token_amount) ?? 0n).toString(),
      tokenContract: row.token_contract,
      chainId: row.chain_id,
      confirmations: prenaServerConfig.minConfirmations,
      success: true,
    };
  }

  async getUsdPricePerToken(): Promise<{ price: number; source: string }> {
    const price = Number.isFinite(prenaServerConfig.devUsdPrice) && prenaServerConfig.devUsdPrice > 0
      ? prenaServerConfig.devUsdPrice
      : 0.01;
    return { price, source: 'mock:PRENA_DEV_USD_PRICE' };
  }
}
