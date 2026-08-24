'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ArenaMark } from './arena-mark';
import { buttonClass } from './ui';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/arenas', label: 'Arenas' },
  { href: '/hall-of-fame', label: 'Hall of Fame' },
  { href: '/enter', label: 'Enter' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b hairline bg-ink-950/80 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden border border-arena/25 bg-arena/[0.06]">
            <span className="absolute inset-0 translate-y-full bg-arena transition-transform duration-300 group-hover:translate-y-0" aria-hidden />
            <ArenaMark className="relative h-[18px] w-[18px] text-arena transition-colors duration-300 group-hover:text-ink-950" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-bone">Project Arena</span>
        </Link>

        <nav className="hidden h-full items-center gap-7 md:flex" aria-label="Primary navigation">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex h-full items-center font-mono text-[10px] uppercase tracking-widest transition-colors duration-200 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:bg-arena after:transition-transform after:duration-300',
                  active
                    ? 'text-bone after:scale-x-100'
                    : 'text-bone-faint after:scale-x-0 hover:text-bone hover:after:scale-x-100',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden font-mono text-[10px] uppercase tracking-widest text-bone-dim transition-colors hover:text-bone sm:inline">
            Sign in
          </Link>
          <Link href="/enter" className={cn(buttonClass('primary', 'sm'), 'hidden lg:inline-flex')}>
            Enter the Arena
          </Link>
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            className="inline-flex h-11 w-11 items-center justify-center border border-white/10 text-bone-dim transition-colors hover:border-white/25 hover:text-bone md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-navigation" className="animate-rise-in border-t hairline bg-ink-950/98 md:hidden">
          <nav className="mx-auto flex w-full max-w-[1240px] flex-col px-5 pb-5 sm:px-8" aria-label="Mobile navigation">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex min-h-14 items-center justify-between border-b hairline font-mono text-[11px] uppercase tracking-widest',
                    active ? 'text-bone' : 'text-bone-dim',
                  )}
                >
                  {item.label}
                  <span className={cn('h-1.5 w-1.5', active ? 'bg-arena' : 'border border-white/20')} aria-hidden />
                </Link>
              );
            })}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex min-h-14 items-center border-b hairline font-mono text-[11px] uppercase tracking-widest text-bone-dim sm:hidden"
            >
              Sign in
            </Link>
            <Link
              href="/enter"
              onClick={() => setOpen(false)}
              className={cn(buttonClass('primary', 'md'), 'mt-5 lg:hidden')}
            >
              Enter the Arena
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
