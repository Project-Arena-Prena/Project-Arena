import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { Container } from '@/components/ui';

export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/arenas', label: 'Arenas' },
  { href: '/admin/entries', label: 'Entries' },
  { href: '/admin/projects', label: 'Projects' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/prena', label: '$PRENA' },
  { href: '/admin/fraud', label: 'Fraud' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/dry-run', label: 'Dry-run' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin('/admin');
  return (
    <div className="pb-20">
      <div className="border-b hairline bg-ink-900/70">
        <Container className="flex flex-wrap items-center justify-between gap-3 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-arena">Admin</span>
          <nav className="flex flex-wrap gap-4">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-mono text-[10px] uppercase tracking-widest text-bone-faint hover:text-bone"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </Container>
      </div>
      {children}
    </div>
  );
}
