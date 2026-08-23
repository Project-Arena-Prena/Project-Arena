'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCompact } from '@/lib/format';
import { getVisitorId, supportStorageKey } from '@/lib/visitor';

/**
 * Optimistic support with explicit rollback. Identity is anonymous and stays
 * in this browser; the server and database enforce the final uniqueness rule.
 */
export function SupportButton({
  projectSlug,
  arenaSlug,
  initialSupporters,
  onScoreChange,
  compact = false,
}: {
  projectSlug: string;
  arenaSlug: string;
  initialSupporters: number;
  onScoreChange?: (delta: number) => void;
  compact?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [count, setCount] = useState(initialSupporters);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(window.localStorage.getItem(supportStorageKey(arenaSlug, projectSlug)) === '1');
  }, [arenaSlug, projectSlug]);

  async function support() {
    if (supported || pending) return;
    const storageKey = supportStorageKey(arenaSlug, projectSlug);
    const visitorId = getVisitorId();
    setSupported(true);
    setPending(true);
    setError(null);
    setCount((c) => c + 1);
    onScoreChange?.(1);
    window.localStorage.setItem(storageKey, '1');

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectSlug, arenaSlug, visitorId }),
      });
      const payload = (await response.json().catch(() => null)) as { duplicate?: boolean } | null;
      if (!response.ok) throw new Error('support_failed');
      if (payload?.duplicate) {
        setCount((c) => Math.max(initialSupporters, c - 1));
        onScoreChange?.(-1);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
      setSupported(false);
      setCount((c) => Math.max(initialSupporters, c - 1));
      onScoreChange?.(-1);
      setError('Try again');
    } finally {
      setPending(false);
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={support}
        aria-label={`Support ${projectSlug}`}
        aria-pressed={supported}
        disabled={pending}
        title={error ?? undefined}
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
        disabled={pending}
        title={error ?? undefined}
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
        href={`/go/${projectSlug}?arena=${encodeURIComponent(arenaSlug)}`}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => getVisitorId()}
        aria-label="Visit project"
        className="hidden h-8 w-8 items-center justify-center border border-white/15 text-bone-dim transition-colors duration-200 hover:border-white/40 hover:text-bone md:inline-flex"
      >
        <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
