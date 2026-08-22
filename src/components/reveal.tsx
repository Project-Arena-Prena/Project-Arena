import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * CSS-driven so the content is never stranded at opacity:0 when JS is slow or
 * blocked — a client-animated wrapper would hide the whole page until hydration.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={cn('animate-rise-in', className)} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}
