'use client';

import { useState, useTransition } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCompact } from '@/lib/format';

/**
 * Optimistic support + outbound-click tracking. The POST is fire-and-forget:
 * a failed beacon must never block the visitor from reaching the project.
 */
export function SupportButton({
  projectSlug,
  projectUrl,
  arenaSlug,
  initialSupporters,
  compact = false,
}: {
  projectSlug: string;
  projectUrl: string;
  arenaSlug: string;
  initialSupporters: number;
  compact?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [count, setCount] = useState(initialSupporters);
  const [, startTransition] = useTransition();

  function support() {
    if (supported) return;
    setSupported(true);
    setCount((c) => c + 1);
    startTransition(() => {
      void fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectSlug, arenaSlug }),
        keepalive: true,
      }).catch(() => undefined);
    });
  }

  function trackVisit() {
    void fetch('/api/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectSlug, arenaSlug }),
      keepalive: true,
    }).catch(() => undefined);
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={support}
        aria-label={`Support ${projectSlug}`}
        aria-pressed={supported}
        className={cn(
          'inline-flex h-7 items-center gap-1 border px-2 font-mono text-[10px] uppercase tracking-widest transition-colors',
          supported
            ? 'border-arena/40 bg-arena/10 text-arena'
            : 'border-white/15 text-bone-dim hover:border-white/40 hover:text-bone',
        )}
      >
        {supported ? <Check className="h-3 w-3" /> : null}
        {supported ? 'In' : 'Back'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={support}
        aria-pressed={supported}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 border px-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors duration-200',
          supported
            ? 'border-arena/40 bg-arena/10 text-arena'
            : 'border-white/15 text-bone-dim hover:border-white/40 hover:text-bone',
        )}
      >
        {supported ? <Check className="h-3 w-3" /> : null}
        {supported ? formatCompact(count) : 'Support'}
      </button>
      <a
        href={projectUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={trackVisit}
        aria-label="Visit project"
        className="inline-flex h-8 w-8 items-center justify-center border border-white/15 text-bone-dim transition-colors duration-200 hover:border-white/40 hover:text-bone"
      >
        <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
