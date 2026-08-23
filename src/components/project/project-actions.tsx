'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { buttonClass } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { getVisitorId, supportStorageKey } from '@/lib/visitor';

/** Project-level actions share the same validated support and redirect flow as leaderboard cards. */
export function ProjectActions({
  projectSlug,
  projectName,
  liveArenaSlug,
  initialSupporters = 0,
}: {
  projectSlug: string;
  projectName: string;
  liveArenaSlug?: string | null;
  initialSupporters?: number;
}) {
  const [supported, setSupported] = useState(false);
  const [count, setCount] = useState(initialSupporters);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!liveArenaSlug) return;
    setSupported(window.localStorage.getItem(supportStorageKey(liveArenaSlug, projectSlug)) === '1');
  }, [liveArenaSlug, projectSlug]);

  async function support() {
    if (supported || pending || !liveArenaSlug) return;
    const visitorId = getVisitorId();
    const storageKey = supportStorageKey(liveArenaSlug, projectSlug);
    setSupported(true);
    setPending(true);
    setCount((c) => c + 1);
    window.localStorage.setItem(storageKey, '1');

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectSlug, arenaSlug: liveArenaSlug, visitorId }),
      });
      const payload = (await response.json().catch(() => null)) as { duplicate?: boolean } | null;
      if (!response.ok) throw new Error('support_failed');
      if (payload?.duplicate) setCount((c) => Math.max(initialSupporters, c - 1));
    } catch {
      window.localStorage.removeItem(storageKey);
      setSupported(false);
      setCount((c) => Math.max(initialSupporters, c - 1));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-[248px]">
      <a
        href={`/go/${projectSlug}${liveArenaSlug ? `?arena=${encodeURIComponent(liveArenaSlug)}` : ''}`}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => getVisitorId()}
        aria-label={`Visit ${projectName}`}
        className={buttonClass('primary', 'md', 'w-full')}
      >
        Visit Project
        <ArrowUpRight className="h-3.5 w-3.5" />
      </a>

      {liveArenaSlug ? (
        <button
          type="button"
          onClick={support}
          aria-pressed={supported}
          disabled={pending}
          className={buttonClass(
            'secondary',
            'md',
            supported ? 'w-full border-arena/40 bg-arena/10 text-arena hover:border-arena/40' : 'w-full',
          )}
        >
          {supported ? <Check className="h-3.5 w-3.5" /> : null}
          {supported ? `Supported · ${formatNumber(count)}` : 'Support'}
        </button>
      ) : null}
    </div>
  );
}
