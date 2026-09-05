import Image from 'next/image';
import Link from 'next/link';
import { Container } from './ui';

const EXPLORE = [
  { href: '/arenas', label: 'Arenas' },
  { href: '/hall-of-fame', label: 'Hall of Fame' },
  { href: '/arenas#live', label: 'Watch Live' },
];

const BUILDERS = [
  { href: '/enter', label: 'Enter a Project' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/login', label: 'Sign In' },
];

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-24 overflow-hidden bg-ink-950">
      <Container>
        <div className="relative overflow-hidden border-t hairline pt-10" aria-hidden="true">
          <span className="block whitespace-nowrap font-display text-[clamp(4.5rem,14vw,10.5rem)] font-semibold uppercase leading-[0.72] tracking-[-0.075em] text-white/[0.035]">
            Project Arena
          </span>
          <span className="absolute left-0 top-10 h-px w-24 bg-gradient-to-r from-arena to-transparent" />
        </div>

        <div className="flex flex-col gap-14 py-12 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Link href="/" className="inline-flex">
              <Image
                src="/project-arena-logo.png"
                alt="Project Arena"
                width={1536}
                height={1024}
                sizes="144px"
                className="h-24 w-auto object-contain brightness-0 invert"
              />
            </Link>
            <p className="mt-5 text-sm leading-relaxed text-bone-dim">
              Where projects compete for attention.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-16 sm:gap-24">
            <FooterLinks title="Explore" links={EXPLORE} />
            <FooterLinks title="Builders" links={BUILDERS} />
          </div>
        </div>

        <div className="flex min-h-16 flex-col justify-center gap-2 border-t hairline py-4 font-mono text-[8px] uppercase tracking-[0.16em] text-bone-faint sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getUTCFullYear()} Project Arena</span>
          <span>Discover. Compete. Get seen.</span>
        </div>
      </Container>
    </footer>
  );
}

function FooterLinks({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <nav className="flex flex-col gap-3">
      <span className="mb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-bone-faint">
        {title}
      </span>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-xs text-bone-dim transition-colors hover:text-bone"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
