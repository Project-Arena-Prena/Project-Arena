'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Keep identical to the static layout gates in globals.css.
const STATIC_GATES = [
  '(max-width: 720px)',
  '(orientation: portrait) and (max-width: 1024px)',
  '(orientation: portrait) and (pointer: coarse)',
  '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
  '(prefers-reduced-motion: reduce)',
];
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
type Connection = EventTarget & { saveData?: boolean; effectiveType?: string };

export function GatewayJourney({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const region = root.current;
    const video = region?.querySelector('video');
    if (!region || !video || !('IntersectionObserver' in window)) return;
    const queries = STATIC_GATES.map((query) => matchMedia(query));
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    let dispose: (() => void) | undefined;

    function enable() {
      // Each enabled session owns every resource, including its Blob URL.
      const host = region!;
      const media = video!;
      const abort = new AbortController();
      let disposed = false;
      let objectUrl = '';
      let ready = false;
      let active = false;
      let visible = true;
      let raf = 0;
      let lastTick = 0;
      let shown = 0;
      let target = 0;
      let busy = false;
      let pendingTime: number | null = null;
      let lastIntro = -1;
      let lastSettle = -1;
      let seekTimeout: ReturnType<typeof setTimeout> | undefined;
      let loadTimeout: ReturnType<typeof setTimeout> | undefined;
      const stop = () => { cancelAnimationFrame(raf); raf = 0; lastTick = 0; };
      function fail() {
        if (disposed) return;
        ready = active = false;
        busy = false;
        pendingTime = null;
        clearTimeout(seekTimeout);
        clearTimeout(loadTimeout);
        abort.abort();
        stop();
        host.dataset.mode = 'static';
        media.removeAttribute('src');
        media.load();
        if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = ''; }
      }
      function seek(time: number) {
        if (!ready || !Number.isFinite(media.duration)) return;
        if (busy) { pendingTime = time; return; }
        if (Math.abs(media.currentTime - time) < 1 / 48) return;
        busy = true;
        try {
          media.currentTime = time;
          clearTimeout(seekTimeout);
          seekTimeout = setTimeout(fail, 5000);
        } catch { fail(); }
      }
      function seeked() {
        busy = false;
        clearTimeout(seekTimeout);
        if (pendingTime !== null) {
          const time = pendingTime;
          pendingTime = null;
          seek(time);
        }
      }
      function captions(progress: number) {
        const intro = Math.round((1 - smooth((progress - .44) / .07)) * 1000) / 1000;
        const settle = Math.round(smooth((progress - .49) / .07) * 1000) / 1000;
        if (intro !== lastIntro) { host.style.setProperty('--hero-intro', String(intro)); lastIntro = intro; }
        if (settle !== lastSettle) { host.style.setProperty('--hero-settle', String(settle)); lastSettle = settle; }
      }
      function tick(now: number) {
        raf = 0;
        if (!active || !visible || document.hidden) { lastTick = 0; return; }
        const dt = Math.min(100, now - (lastTick || now - 16.667));
        lastTick = now;
        shown += (target - shown) * (1 - Math.pow(.84, dt / 16.667));
        if (Math.abs(target - shown) < .0005) shown = target;
        seek(shown * Math.max(0, media.duration - 1 / 24));
        captions(shown);
        if (shown !== target) raf = requestAnimationFrame(tick);
        else lastTick = 0;
      }
      function update() {
        if (!ready || disposed) return;
        // A late download never stretches the document underneath a reader farther down.
        if (!active && host.getBoundingClientRect().top >= -120) {
          active = true;
          host.dataset.mode = 'scrub';
        }
        if (!active) return;
        const bounds = host.getBoundingClientRect();
        target = clamp(-bounds.top / Math.max(1, bounds.height - innerHeight));
        if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick);
      }
      function canplay() {
        if (disposed || abort.signal.aborted || !Number.isFinite(media.duration)) return;
        clearTimeout(loadTimeout);
        ready = true;
        update();
      }
      function visibility() {
        if (document.hidden) stop();
        else update();
      }
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) update(); else stop();
      });
      observer.observe(host);
      media.addEventListener('canplay', canplay);
      media.addEventListener('seeked', seeked);
      media.addEventListener('error', fail);
      window.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      document.addEventListener('visibilitychange', visibility);
      const start = setTimeout(async () => {
        loadTimeout = setTimeout(fail, 20_000);
        try {
          const response = await fetch('/art/founding-gateway-scrub.mp4', { signal: abort.signal, priority: 'low' });
          if (!response.ok) throw new Error('Video unavailable');
          const blob = await response.blob();
          if (disposed || abort.signal.aborted) return;
          if (!blob.size || blob.size > 8 * 1024 * 1024) throw new Error('Video exceeds the hero budget');
          objectUrl = URL.createObjectURL(blob);
          media.src = objectUrl;
          media.load();
        } catch { if (!disposed && !abort.signal.aborted) fail(); }
      }, 250);
      return () => {
        disposed = true;
        abort.abort();
        clearTimeout(start);
        clearTimeout(loadTimeout);
        clearTimeout(seekTimeout);
        stop();
        observer.disconnect();
        window.removeEventListener('scroll', update);
        window.removeEventListener('resize', update);
        document.removeEventListener('visibilitychange', visibility);
        media.removeEventListener('canplay', canplay);
        media.removeEventListener('seeked', seeked);
        media.removeEventListener('error', fail);
        media.removeAttribute('src');
        media.load();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        host.dataset.mode = 'static';
        host.style.removeProperty('--hero-intro');
        host.style.removeProperty('--hero-settle');
      };
    }
    function applyMode() {
      dispose?.();
      dispose = undefined;
      if (queries.some((query) => query.matches) || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return;
      dispose = enable();
    }
    applyMode();
    queries.forEach((query) => query.addEventListener('change', applyMode));
    connection?.addEventListener('change', applyMode);
    return () => {
      dispose?.();
      queries.forEach((query) => query.removeEventListener('change', applyMode));
      connection?.removeEventListener('change', applyMode);
    };
  }, []);
  return <div ref={root} className="gateway-journey" data-mode="static">{children}</div>;
}
