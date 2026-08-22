import Link from 'next/link';
import { Container } from '@/components/ui';

export function AccountStrip({ email }: { email: string | null }) {
  return (
    <div className="border-b hairline bg-ink-900/60">
      <Container className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2.5">
        {email ? (
          <>
            <span className="label">
              Signed In
              <span className="mx-2 text-bone-faint/50">/</span>
              <span className="normal-case text-bone-dim">{email}</span>
            </span>
            <span className="label">Builder</span>
          </>
        ) : (
          <>
            <span className="label">
              Demo Mode
              <span className="mx-2 text-bone-faint/50">/</span>
              <span className="text-bone-dim">Sign in to manage your own projects</span>
            </span>
            <Link
              href="/enter"
              className="font-mono text-[10px] uppercase tracking-widest text-arena transition-colors duration-200 hover:text-bone"
            >
              Sign In
            </Link>
          </>
        )}
      </Container>
    </div>
  );
}
