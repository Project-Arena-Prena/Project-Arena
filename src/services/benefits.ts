import { createAdminClient } from '@/lib/supabase/server';
import { prenaServerConfig } from '@/lib/prena/config';
import { getPrimaryWallet } from './wallet';
import { getPrenaBalance } from './token';
import { toBaseUnits } from '@/lib/prena/amount';

/**
 * Token perks — configuration-driven capability checks.
 *
 * HARD RULE: nothing returned here touches Arena score, votes, rank, supporter
 * weight, or Trending placement. These benefits only affect who may pay how,
 * who may register when, and a cosmetic verification marker.
 */

export interface PrenaBenefits {
  entryDiscountEligible: boolean;
  earlyRegistrationEligible: boolean;
  verifiedBuilderEligible: boolean;
  /** Why each flag is what it is, for the dashboard and for support. */
  reasons: {
    walletLinked: boolean;
    balanceKnown: boolean;
    balanceRaw: string | null;
    holdsEarlyRegistrationMinimum: boolean;
    holdsVerifiedMinimum: boolean;
    completedArenas: number;
  };
  thresholds: {
    earlyRegistration: string;
    verifiedBuilder: string;
    verifiedMinArenas: number;
  };
}

function threshold(name: string, fallback: string): string {
  const raw = process.env[name];
  const value = raw && raw.trim() ? raw.trim() : fallback;
  try {
    return toBaseUnits(value, prenaServerConfig.tokenDecimals).toString();
  } catch {
    return toBaseUnits(fallback, prenaServerConfig.tokenDecimals).toString();
  }
}

function benefitThresholds() {
  return {
    earlyRegistration: threshold('PRENA_EARLY_REGISTRATION_MIN', '10000'),
    verifiedBuilder: threshold('PRENA_VERIFIED_BUILDER_MIN', '2500'),
    verifiedMinArenas: Number.parseInt(process.env.PRENA_VERIFIED_MIN_ARENAS ?? '1', 10) || 1,
  };
}

export async function getBuilderPrenaBenefits(builderId: string): Promise<PrenaBenefits> {
  const thresholds = benefitThresholds();
  const empty: PrenaBenefits = {
    // The entry discount is a property of the Arena, not of the Builder — every
    // Builder with a verified wallet can use it where the Arena enables it.
    entryDiscountEligible: false,
    earlyRegistrationEligible: false,
    verifiedBuilderEligible: false,
    reasons: {
      walletLinked: false,
      balanceKnown: false,
      balanceRaw: null,
      holdsEarlyRegistrationMinimum: false,
      holdsVerifiedMinimum: false,
      completedArenas: 0,
    },
    thresholds,
  };

  const wallet = await getPrimaryWallet(builderId);
  if (!wallet) return empty;

  const supabase = createAdminClient();
  let completedArenas = 0;
  if (supabase) {
    const { count } = await supabase
      .from('arena_entries')
      .select('id', { count: 'exact', head: true })
      .eq('builder_id', builderId)
      .eq('status', 'finished');
    completedArenas = count ?? 0;
  }

  const balance = await getPrenaBalance(wallet.address);
  if (!balance.ok) {
    return {
      ...empty,
      entryDiscountEligible: true,
      reasons: { ...empty.reasons, walletLinked: true, completedArenas },
    };
  }

  const raw = BigInt(balance.balance.raw);
  const holdsEarly = raw >= BigInt(thresholds.earlyRegistration);
  const holdsVerified = raw >= BigInt(thresholds.verifiedBuilder);

  return {
    entryDiscountEligible: true,
    earlyRegistrationEligible: holdsEarly,
    verifiedBuilderEligible: holdsVerified && completedArenas >= thresholds.verifiedMinArenas,
    reasons: {
      walletLinked: true,
      balanceKnown: true,
      balanceRaw: balance.balance.raw,
      holdsEarlyRegistrationMinimum: holdsEarly,
      holdsVerifiedMinimum: holdsVerified,
      completedArenas,
    },
    thresholds,
  };
}

/**
 * Whether a Builder may register for an Arena before general registration.
 * Affects timing only — never capacity priority, seeding, or score.
 */
export async function canRegisterEarly(input: {
  builderId: string;
  earlyRegistrationAt: string | null;
  registrationOpensAt: string | null;
}): Promise<boolean> {
  if (!input.earlyRegistrationAt || !input.registrationOpensAt) return false;
  const now = Date.now();
  if (now >= Date.parse(input.registrationOpensAt)) return false;
  if (now < Date.parse(input.earlyRegistrationAt)) return false;
  const benefits = await getBuilderPrenaBenefits(input.builderId);
  return benefits.earlyRegistrationEligible;
}
