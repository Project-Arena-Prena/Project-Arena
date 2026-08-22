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
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b hairline bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <ArenaMark className="h-5 w-5 text-bone" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-bone">Project Arena</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'font-mono text-[11px] uppercase tracking-widest transition-colors duration-200',
                  active ? 'text-bone' : 'text-bone-faint hover:text-bone',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/enter" className={cn(buttonClass('primary', 'sm'), 'hidden sm:inline-flex')}>
            Enter the Arena
          </Link>
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="text-bone-dim transition-colors hover:text-bone md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t hairline bg-ink-950 md:hidden">
          <nav className="mx-auto flex w-full max-w-[1240px] flex-col px-5 sm:px-8">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b hairline py-4 font-mono text-[11px] uppercase tracking-widest text-bone-dim last:border-0"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/enter"
              onClick={() => setOpen(false)}
              className={cn(buttonClass('primary', 'md'), 'my-4 sm:hidden')}
            >
              Enter the Arena
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
