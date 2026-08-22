import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ---------------------------------------------------------------- primitives */

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1240px] px-5 sm:px-8', className)}>{children}</div>;
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('border hairline bg-ink-900/60', className)}>{children}</div>;
}

export function Label({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('label', className)}>{children}</span>;
}

export function Rule({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-white/[0.08]', className)} />;
}

/* ------------------------------------------------------------------- buttons */

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 border font-mono uppercase tracking-widest transition-colors duration-200 disabled:pointer-events-none disabled:opacity-40';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-arena bg-arena text-ink-950 hover:bg-arena-hot hover:border-arena-hot',
  secondary: 'border-white/15 bg-transparent text-bone hover:border-white/40 hover:bg-white/[0.04]',
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
      <span className="absolute inset-0 rounded-full bg-live blur-[3px] opacity-70" />
    </span>
  );
}

export function StatusBadge({ status }: { status: 'live' | 'upcoming' | 'finished' }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 border border-live/30 bg-live/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-live">
        <LiveDot />
        Live
      </span>
    );
  }
  if (status === 'upcoming') {
    return (
      <span className="inline-flex items-center gap-1.5 border border-white/15 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-bone-dim">
        Upcoming
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-bone-faint">
        Finished
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
        <h2 className="text-2xl font-semibold tracking-headline sm:text-3xl">{title}</h2>
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
