'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Keep identical to the static layout gates in globals.css.
const STATIC_GATES = [
  '(max-width: 720px) and (max-height: 680px)',
  '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
  '(prefers-reduced-motion: reduce)',
];
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
type Connection = EventTarget & { saveData?: boolean; effectiveType?: string };

export function GatewayJourney({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = root.current;
    const artwork = host?.querySelector<HTMLImageElement>('.founding-hero-art img');
    const video = host?.querySelector<HTMLVideoElement>('.gateway-video');
    if (!host || !artwork || !('IntersectionObserver' in window)) return;
    const queries = STATIC_GATES.map((query) => matchMedia(query));
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    let enabled = false;
    let active = false;
    let visible = true;
    let frame = 0;
    let lastTick = 0;
    let shown = 0;
    let target = 0;
    let lastWritten = -1;
    let failed = false;

    function seekVideo() {
      if (!video || failed || !active || !visible || document.hidden || video.seeking || video.readyState < 1 || !Number.isFinite(video.duration)) return;
      // One seek in flight. Always catch up to the latest scroll position after decoding.
      const lastFrame = Math.max(0, Math.floor(video.duration * 24) - 1);
      const time = Math.round(shown * lastFrame) / 24;
      if (Math.abs(video.currentTime - time) > 1 / 48) video.currentTime = time;
    }
    function mediaReady() {
      if (!active || failed || !video || video.readyState < 2) return;
      host!.dataset.video = 'ready';
      seekVideo();
    }
    function mediaFailed() {
      failed = true;
      host!.dataset.video = 'unavailable';
    }
    function loadVideo() {
      if (!video || failed || video.hasAttribute('src')) return;
      host!.dataset.video = 'loading';
      video.preload = 'auto';
      video.src = matchMedia('(max-width: 1024px), (pointer: coarse)').matches
        ? '/media/arena-scroll-mobile.mp4' : '/media/arena-scroll-desktop.mp4';
      video.load();
    }

    function stop() { cancelAnimationFrame(frame); frame = 0; lastTick = 0; }
    function paint(progress: number) {
      const rounded = Math.round(progress * 10000) / 10000;
      if (rounded === lastWritten) return;
      lastWritten = rounded;
      host!.style.setProperty('--hero-progress', String(rounded));
      host!.style.setProperty('--hero-intro', String(Math.round((1 - smooth((progress - .34) / .12)) * 1000) / 1000));
      host!.style.setProperty('--hero-settle', String(Math.round(smooth((progress - .43) / .12) * 1000) / 1000));
    }
    function tick(now: number) {
      frame = 0;
      if (!active || !visible || document.hidden) { lastTick = 0; return; }
      const dt = Math.min(100, now - (lastTick || now - 16.667));
      lastTick = now;
      shown += (target - shown) * (1 - Math.pow(.8, dt / 16.667));
      if (Math.abs(target - shown) < .0005) shown = target;
      paint(shown);
      seekVideo();
      if (shown !== target) frame = requestAnimationFrame(tick);
      else lastTick = 0;
    }
    function update() {
      if (!enabled || !artwork!.complete || !artwork!.naturalWidth) return;
      // Do not expand the page underneath someone who has already scrolled on.
      if (!active && host!.getBoundingClientRect().top >= -120) {
        active = true;
        host!.dataset.mode = 'scroll';
        loadVideo();
      }
      if (!active) return;
      const bounds = host!.getBoundingClientRect();
      target = clamp(-bounds.top / Math.max(1, bounds.height - (host!.querySelector<HTMLElement>('.founding-hero')?.offsetHeight ?? innerHeight)));
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick);
    }
    function applyMode() {
      stop();
      active = false;
      if (video?.hasAttribute('src')) { video.pause(); video.removeAttribute('src'); video.load(); }
      delete host!.dataset.video;
      shown = target = 0;
      lastWritten = -1;
      host!.dataset.mode = 'static';
      ['--hero-progress', '--hero-intro', '--hero-settle'].forEach((property) => host!.style.removeProperty(property));
      enabled = !queries.some((query) => query.matches) && !connection?.saveData && !/(^|-)2g$/.test(connection?.effectiveType ?? '');
      update();
    }
    function visibility() { if (document.hidden) stop(); else update(); }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) update(); else stop();
    });
    observer.observe(host);
    artwork.addEventListener('load', update);
    video?.addEventListener('loadeddata', mediaReady);
    video?.addEventListener('seeked', mediaReady);
    video?.addEventListener('error', mediaFailed);
    queries.forEach((query) => query.addEventListener('change', applyMode));
    connection?.addEventListener('change', applyMode);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    document.addEventListener('visibilitychange', visibility);
    applyMode();
    return () => {
      stop();
      observer.disconnect();
      artwork.removeEventListener('load', update);
      video?.removeEventListener('loadeddata', mediaReady);
      video?.removeEventListener('seeked', mediaReady);
      video?.removeEventListener('error', mediaFailed);
      if (video?.hasAttribute('src')) { video.pause(); video.removeAttribute('src'); video.load(); }
      queries.forEach((query) => query.removeEventListener('change', applyMode));
      connection?.removeEventListener('change', applyMode);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('visibilitychange', visibility);
      host.dataset.mode = 'static';
      ['--hero-progress', '--hero-intro', '--hero-settle'].forEach((property) => host.style.removeProperty(property));
    };
  }, []);
  return <div ref={root} className="gateway-journey" data-mode="static">{children}</div>;
}
