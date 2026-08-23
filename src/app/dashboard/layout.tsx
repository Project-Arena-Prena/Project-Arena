import Link from 'next/link';
import { requireBuilder } from '@/lib/auth';
import { Container } from '@/components/ui';
import { WalletProvider } from '@/components/prena/wallet-provider';
import { getBuilderWallets } from '@/services/wallet';

export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/projects', label: 'Projects' },
  { href: '/dashboard/prena', label: '$PRENA' },
  { href: '/dashboard/billing', label: 'Billing' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBuilder('/dashboard');
  const wallets = await getBuilderWallets(ctx.builder.id);

  return (
    <WalletProvider
      initialWallets={wallets.map((wallet) => ({
        id: wallet.id,
        address: wallet.address,
        chainId: wallet.chainId,
        isPrimary: wallet.isPrimary,
        verifiedAt: wallet.verifiedAt,
      }))}
    >
    <div className="pb-20">
      <div className="border-b hairline bg-ink-900/60">
        <Container className="flex flex-wrap items-center justify-between gap-3 py-2.5">
          <span className="label">
            Signed in
            <span className="mx-2 text-bone-faint/50">/</span>
            <span className="normal-case text-bone-dim">{ctx.email}</span>
          </span>
          <div className="flex items-center gap-5">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-mono text-[10px] uppercase tracking-widest text-bone-faint transition-colors hover:text-bone"
              >
                {link.label}
              </Link>
            ))}
            {ctx.isAdmin ? (
              <Link
                href="/admin"
                className="font-mono text-[10px] uppercase tracking-widest text-arena"
              >
                Admin
              </Link>
            ) : null}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="font-mono text-[10px] uppercase tracking-widest text-bone-faint hover:text-bone"
              >
                Sign out
              </button>
            </form>
          </div>
        </Container>
      </div>
      {children}
    </div>
    </WalletProvider>
  );
}
