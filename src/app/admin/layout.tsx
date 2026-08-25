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
  { href: '/admin/fraud', label: 'Fraud' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/dry-run', label: 'Dry-run' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin('/admin');
  return (
    <div className="pb-20">
      <div className="border-b border-arena/35 bg-[#0c0705]">
        <Container className="flex flex-wrap items-center justify-between gap-3 py-2.5">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-arena">Race control / Admin</span>
          <nav className="flex flex-wrap gap-4">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-mono text-[9px] uppercase tracking-[0.13em] text-bone-dim hover:text-arena"
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
