import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ---------------------------------------------------------------- primitives */

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1240px] px-5 sm:px-8', className)}>{children}</div>;
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('border hairline bg-ink-900', className)}>{children}</div>;
}

export function Label({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('label', className)}>{children}</span>;
}

export function Rule({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-white/[0.14]', className)} />;
}

/* ------------------------------------------------------------------- buttons */

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 border font-mono font-semibold uppercase tracking-[0.13em] transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40 disabled:hover:translate-y-0';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-arena bg-arena text-ink-950 hover:border-arena-hot hover:bg-arena-hot hover:shadow-[0_12px_34px_rgba(232,80,2,0.18)]',
  secondary: 'border-white/30 bg-transparent text-bone hover:border-white/70 hover:bg-white/[0.04]',
  ghost: 'border-transparent bg-transparent text-bone-dim hover:text-bone',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[10px]',
  md: 'h-11 px-5 text-[11px]',
  lg: 'h-14 px-8 text-xs',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/* -------------------------------------------------------------------- status */

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex h-1.5 w-1.5', className)} aria-hidden>
      <span className="absolute inset-0 rounded-full bg-live animate-pulse-dot" />
      <span className="absolute inset-0 rounded-full bg-live blur-[5px] opacity-80" />
    </span>
  );
}

export function StatusBadge({
  status,
}: {
  status:
    | 'live'
    | 'upcoming'
    | 'finished'
    | 'draft'
    | 'registration'
    | 'full'
    | 'cancelled'
    | 'pending_review'
    | 'pending_payment'
    | 'approved'
    | 'rejected'
    | 'competing'
    | 'withdrawn'
    | 'disqualified'
    | 'paid'
    | 'pending'
    | 'failed'
    | 'refunded'
    | 'overflow'
    // Token payment rail.
    | 'confirming'
    | 'confirmed'
    | 'expired';
}) {
  const map: Record<string, { label: string; className: string; live?: boolean }> = {
    live: { label: 'Live', className: 'border-live/40 bg-live/10 text-live', live: true },
    competing: { label: 'Competing', className: 'border-live/30 bg-live/10 text-live', live: true },
    upcoming: { label: 'Upcoming', className: 'border-white/15 text-bone-dim' },
    registration: { label: 'Registration', className: 'border-white/15 text-bone-dim' },
    full: { label: 'Arena Full', className: 'border-arena/40 text-arena' },
    draft: { label: 'Draft', className: 'border-white/10 text-bone-faint' },
    finished: { label: 'Finished', className: 'border-white/10 text-bone-faint' },
    cancelled: { label: 'Cancelled', className: 'border-arena/30 text-arena' },
    pending_review: { label: 'Pending Review', className: 'border-gold/30 text-gold' },
    pending_payment: { label: 'Pending Payment', className: 'border-white/15 text-bone-dim' },
    approved: { label: 'Approved', className: 'border-live/30 text-live' },
    rejected: { label: 'Rejected', className: 'border-arena/30 text-arena' },
    withdrawn: { label: 'Withdrawn', className: 'border-white/10 text-bone-faint' },
    disqualified: { label: 'Disqualified', className: 'border-arena/30 text-arena' },
    paid: { label: 'Paid', className: 'border-live/30 text-live' },
    pending: { label: 'Pending', className: 'border-white/15 text-bone-dim' },
    failed: { label: 'Failed', className: 'border-arena/30 text-arena' },
    refunded: { label: 'Refunded', className: 'border-white/15 text-bone-dim' },
    overflow: { label: 'Needs Refund', className: 'border-arena/30 text-arena' },
    confirming: { label: 'Confirming', className: 'border-white/15 text-bone-dim' },
    confirmed: { label: 'Confirmed', className: 'border-live/30 text-live' },
    expired: { label: 'Expired', className: 'border-white/10 text-bone-faint' },
  };
  const item = map[status] ?? { label: status, className: 'border-white/10 text-bone-faint' };
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${item.className}`}>
      {item.live ? <LiveDot /> : null}
      {item.label}
    </span>
  );
}

/* ---------------------------------------------------------------------- data */

export function Stat({
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label>{label}</Label>
      <span
        className={cn(
          'num text-2xl leading-none tracking-tight sm:text-[28px]',
          accent ? 'text-arena' : 'text-bone',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-end justify-between gap-6 pb-5', className)}>
      <div className="flex flex-col gap-2">
        {eyebrow ? <Label>{eyebrow}</Label> : null}
        <h2 className="text-3xl font-semibold uppercase leading-[0.95] tracking-[-0.055em] sm:text-5xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 border hairline border-dashed px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-bone-dim">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-bone-faint">{hint}</p> : null}
    </div>
  );
}
