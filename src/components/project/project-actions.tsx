'use client';

import { useState, useTransition } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { buttonClass } from '@/components/ui';
import { formatNumber } from '@/lib/format';

/** Support + outbound-visit beacons are fire-and-forget: a failed POST must never block the visit. */
export function ProjectActions({
  projectSlug,
  projectName,
  projectUrl,
  liveArenaSlug,
  initialSupporters = 0,
}: {
  projectSlug: string;
  projectName: string;
  projectUrl: string;
  liveArenaSlug?: string | null;
  initialSupporters?: number;
}) {
  const [supported, setSupported] = useState(false);
  const [count, setCount] = useState(initialSupporters);
  const [, startTransition] = useTransition();

  function support() {
    if (supported || !liveArenaSlug) return;
    setSupported(true);
    setCount((c) => c + 1);
    startTransition(() => {
      void fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectSlug, arenaSlug: liveArenaSlug }),
        keepalive: true,
      }).catch(() => undefined);
    });
  }

  function trackVisit() {
    void fetch('/api/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectSlug, arenaSlug: liveArenaSlug ?? undefined }),
      keepalive: true,
    }).catch(() => undefined);
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-[248px]">
      <a
        href={projectUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={trackVisit}
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
