'use client';

import { useEffect, useRef } from 'react';
import { getVisitorId } from '@/lib/visitor';

export function ImpressionTracker({
  projectSlug,
  arenaSlug,
}: {
  projectSlug: string;
  arenaSlug: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const sent = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || sent.current) return;
    let timer: number | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          if (timer) window.clearTimeout(timer);
          timer = null;
          return;
        }
        timer = window.setTimeout(() => {
          if (sent.current) return;
          sent.current = true;
          const visitorId = getVisitorId();
          void fetch('/api/impressions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectSlug, arenaSlug, visitorId }),
          });
        }, 1000);
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [projectSlug, arenaSlug]);

  return <div ref={ref} className="absolute inset-0" aria-hidden />;
}
