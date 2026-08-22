import Link from 'next/link';
import { ArenaMark } from './arena-mark';
import { Container } from './ui';

const LINKS = [
  { href: '/arenas', label: 'Arenas' },
  { href: '/hall-of-fame', label: 'Hall of Fame' },
  { href: '/enter', label: 'Enter' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t hairline">
      <Container className="flex flex-col gap-8 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex max-w-xs flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <ArenaMark className="h-5 w-5 text-bone" />
            <span className="font-mono text-[11px] uppercase tracking-widest">Project Arena</span>
          </div>
          <p className="text-sm leading-relaxed text-bone-faint">
            Where projects compete for attention. Discover. Compete. Get seen.
          </p>
        </div>

        <nav className="flex flex-col gap-3">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-mono text-[11px] uppercase tracking-widest text-bone-faint transition-colors hover:text-bone"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </Container>
      <Container className="border-t hairline py-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
          © {new Date().getUTCFullYear()} Project Arena
        </p>
      </Container>
    </footer>
  );
}
