'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

type RevealDirection = 'up' | 'left' | 'right' | 'scale' | 'none';

const HIDDEN: Record<RevealDirection, { opacity: number; x?: number; y?: number; scale?: number }> = {
  up: { opacity: 0, y: 28 },
  left: { opacity: 0, x: -30 },
  right: { opacity: 0, x: 30 },
  scale: { opacity: 0, scale: 0.975 },
  none: { opacity: 0 },
};

/**
 * Content renders visible on the server. Off-screen items are armed before
 * paint and revealed by IntersectionObserver, so no-JS still gets the content.
 */
export function Reveal({
  children,
  delay = 0,
  duration = 0.72,
  direction = 'up',
  className,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  direction?: RevealDirection;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<'server' | 'hidden' | 'visible'>('server');

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || reduceMotion) {
      setState('visible');
      return;
    }

    const rect = node.getBoundingClientRect();
    const initiallyVisible = rect.top <= window.innerHeight * 0.94 && rect.bottom >= 0;
    if (initiallyVisible) {
      setState('visible');
      return;
    }

    setState('hidden');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setState('visible');
        observer.disconnect();
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduceMotion]);

  const visible = state !== 'hidden';

  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={visible ? { opacity: 1, x: 0, y: 0, scale: 1 } : HIDDEN[direction]}
      transition={{
        duration: state === 'hidden' ? 0 : reduceMotion ? 0 : duration,
        delay: state === 'visible' && !reduceMotion ? delay : 0,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(state === 'hidden' && 'will-change-[transform,opacity]', className)}
      data-reveal-state={state}
    >
      {children}
    </motion.div>
  );
}
