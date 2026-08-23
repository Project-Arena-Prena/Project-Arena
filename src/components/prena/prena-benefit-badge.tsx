import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/cn';

export type PrenaBenefit = 'verified' | 'early_registration' | 'entry_discount';

const COPY: Record<PrenaBenefit, { label: string; title: string }> = {
  verified: { label: 'Verified Builder', title: 'Verified through Project Arena' },
  early_registration: { label: 'Early Registration', title: 'Eligible to register before general registration opens' },
  entry_discount: { label: 'Entry Discount', title: 'Eligible for the $PRENA entry discount' },
};

/**
 * A marker, not a multiplier. None of these affect score, votes, or ranking.
 */
export function PrenaBenefitBadge({
  benefit,
  className,
}: {
  benefit: PrenaBenefit;
  className?: string;
}) {
  const copy = COPY[benefit];
  return (
    <span
      title={copy.title}
      className={cn(
        'inline-flex items-center gap-1.5 border border-white/12 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-bone-dim',
        benefit === 'verified' && 'border-gold/30 text-gold',
        className,
      )}
    >
      {benefit === 'verified' ? <BadgeCheck className="h-3 w-3" /> : null}
      {copy.label}
    </span>
  );
}
