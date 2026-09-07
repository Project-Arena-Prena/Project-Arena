'use client';

import { useEffect, useState } from 'react';
import { countdownFrom, pad2 } from '@/lib/format';
import { cn } from '@/lib/cn';

type Size = 'sm' | 'md' | 'lg';

const VALUE_SIZE: Record<Size, string> = {
  sm: 'text-lg sm:text-xl',
  md: 'text-3xl sm:text-4xl',
  lg: 'text-4xl sm:text-6xl',
};

/**
 * A supplied server clock keeps the first paint truthful and hydration stable.
 */
export function Countdown({
  target,
  serverNow,
  size = 'md',
  showDays,
  className,
  onComplete,
}: {
  target: string;
  serverNow?: number;
  size?: Size;
  showDays?: boolean;
  className?: string;
  onComplete?: () => void;
}) {
  const [now, setNow] = useState<number | null>(serverNow ?? null);

  useEffect(() => {
    const origin = performance.now();
    const anchor = serverNow ?? Date.now();
    const id = window.setInterval(() => setNow(anchor + performance.now() - origin), 1000);
    return () => window.clearInterval(id);
  }, [serverNow]);

  const c = countdownFrom(target, now ?? Date.parse(target));
  const done = now !== null && c.total === 0;

  useEffect(() => {
    if (done) onComplete?.();
  }, [done, onComplete]);

  // Never derived from the clock: `days` is 0 during SSR, so an inferred layout
  // would swap 3 units for 4 on hydration.
  const withDays = showDays ?? false;
  const units = withDays
    ? [
        { label: 'Days', value: c.days },
        { label: 'Hrs', value: c.hours },
        { label: 'Min', value: c.minutes },
        { label: 'Sec', value: c.seconds },
      ]
    : [
        { label: 'Hrs', value: c.hours + c.days * 24 },
        { label: 'Min', value: c.minutes },
        { label: 'Sec', value: c.seconds },
      ];

  return (
    <div
      className={cn('flex items-start gap-3 sm:gap-4', className)}
      role="timer"
      aria-live="off"
      suppressHydrationWarning
    >
      {units.map((u, i) => (
        <div key={u.label} className="flex items-start gap-3 sm:gap-4">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                'num leading-none tracking-tight tabular-nums',
                VALUE_SIZE[size],
                done ? 'text-bone-faint' : 'text-bone',
              )}
              suppressHydrationWarning
            >
              {pad2(u.value)}
            </span>
            <span className="label">{u.label}</span>
          </div>
          {i < units.length - 1 ? (
            <span className={cn('num leading-none text-bone-faint', VALUE_SIZE[size])}>:</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
