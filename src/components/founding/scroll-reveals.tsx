'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Server HTML is readable. Only offscreen content opts into an entrance. */
export function ScrollReveals({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = root.current;
    if (!container || !('IntersectionObserver' in window)) return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const elements = [...container.querySelectorAll<HTMLElement>('[data-reveal]')];
    let observer: IntersectionObserver | undefined;
    const reveal = (element: HTMLElement) => {
      element.classList.remove('reveal-pending');
      observer?.unobserve(element);
    };
    const arm = () => {
      observer?.disconnect();
      elements.forEach((element) => element.classList.remove('reveal-pending', 'reveal-settled'));
      if (query.matches) return;
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) reveal(entry.target as HTMLElement);
        });
      }, { rootMargin: '0px 0px -5% 0px', threshold: 0 });
      elements.forEach((element) => {
        // Late hydration and restored scroll positions must never hide a reader's content.
        if (element.getBoundingClientRect().top >= innerHeight && !element.contains(document.activeElement)) {
          element.classList.add('reveal-pending');
          observer?.observe(element);
        }
      });
    };
    const focus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      elements.filter((element) => element.contains(event.target as Element)).forEach(reveal);
    };
    arm();
    const settle = (event: TransitionEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches('[data-reveal]:not(.reveal-pending)')) {
        event.target.classList.add('reveal-settled');
      }
    };
    query.addEventListener('change', arm);
    container.addEventListener('focusin', focus);
    container.addEventListener('transitionend', settle);
    return () => {
      observer?.disconnect();
      query.removeEventListener('change', arm);
      container.removeEventListener('focusin', focus);
      container.removeEventListener('transitionend', settle);
      elements.forEach((element) => element.classList.remove('reveal-pending'));
    };
  }, []);
  return <div ref={root} className="founding-motion">{children}</div>;
}
