'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Menu, Radio, X } from 'lucide-react';
import { ArenaMark } from './arena-mark';
import { buttonClass, LiveDot } from './ui';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/arenas', label: 'Arenas' },
  { href: '/hall-of-fame', label: 'Hall of Fame' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduceMotion = useReducedMotion();
  const isHome = pathname === '/';

  useEffect(() => {
    if (!isHome) return;

    const updateHeader = () => setScrolled(window.scrollY > 24);
    const frame = window.requestAnimationFrame(updateHeader);
    window.addEventListener('scroll', updateHeader, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateHeader);
    };
  }, [isHome]);

  return (
    <header
      className={cn(
        'top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500',
        isHome ? 'fixed inset-x-0' : 'sticky border-b hairline bg-black/90 backdrop-blur-xl',
        isHome && !scrolled
          ? 'border-b border-transparent bg-gradient-to-b from-black/80 via-black/35 to-transparent'
          : isHome && 'border-b hairline bg-black/[0.88] backdrop-blur-xl',
      )}
    >
      <div className="mx-auto flex h-[68px] w-full max-w-[1280px] items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-3" onClick={() => setOpen(false)}>
          <motion.span
            whileHover={reduceMotion ? undefined : { rotate: -3, scale: 1.06 }}
            transition={{ type: 'spring', stiffness: 350, damping: 18 }}
            className="flex"
          >
            <ArenaMark className="h-7 w-7 drop-shadow-[0_0_12px_rgba(232,80,2,0.2)]" />
          </motion.span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-bone sm:text-xs">
            Project Arena
          </span>
        </Link>

        <nav className="ml-auto hidden h-full items-center gap-8 md:flex" aria-label="Primary navigation">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex h-full items-center font-mono text-[10px] font-medium uppercase tracking-[0.14em] transition-colors',
                  active ? 'text-bone' : 'text-bone-dim hover:text-bone',
                )}
              >
                {item.label}
                {active ? (
                  <motion.span
                    layoutId="primary-navigation"
                    className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-arena shadow-[0_0_14px_rgba(232,80,2,0.65)]"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/arena/open-arena-001"
            className="hidden items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-bone-dim transition-colors hover:text-bone lg:inline-flex"
          >
            <LiveDot /> Watch live
          </Link>
          <Link href="/enter" className={cn(buttonClass('primary', 'sm'), 'hidden sm:inline-flex')}>
            Enter Arena
          </Link>
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            className="inline-flex h-11 w-11 items-center justify-center border border-white/20 text-bone transition-colors hover:border-white/60 md:hidden"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            initial={reduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="absolute inset-x-0 top-[68px] border-b hairline bg-black/95 px-5 pb-5 backdrop-blur-xl sm:px-8 md:hidden"
          >
            <Link
              href="/arena/open-arena-001"
              onClick={() => setOpen(false)}
              className="flex min-h-14 items-center gap-2 border-b hairline font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-arena"
            >
              <Radio className="h-3.5 w-3.5" /> Watch live
            </Link>
            {NAV.map((item, index) => (
              <motion.div
                key={item.href}
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduceMotion ? 0 : index * 0.035 }}
              >
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-14 items-center justify-between border-b hairline font-mono text-[11px] uppercase tracking-[0.14em] text-bone-dim"
                >
                  {item.label}
                  <span className="text-arena">→</span>
                </Link>
              </motion.div>
            ))}
            <Link
              href="/enter"
              onClick={() => setOpen(false)}
              className={cn(buttonClass('primary', 'md'), 'mt-5 w-full sm:hidden')}
            >
              Enter Arena
            </Link>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
