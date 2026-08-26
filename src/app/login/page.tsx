import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';
import { Container, Label } from '@/components/ui';
import { getSessionUser } from '@/lib/supabase/server';
import { safeInternalPath } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Builder Sign In',
  description: 'Sign in to manage Projects, enter Arenas, and see what Project Arena delivered.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getSessionUser();
  const { next, error } = await searchParams;
  const destination = safeInternalPath(next, '/dashboard');
  if (user) redirect(destination);

  return (
    <div className="pb-24">
      <section className="relative overflow-hidden border-b hairline bg-ink-900">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-25 [mask-image:linear-gradient(to_right,black,transparent)]" aria-hidden />
        <div className="absolute inset-y-0 left-0 w-1 bg-arena" aria-hidden />
        <Container className="relative py-14 sm:py-20">
          <Label className="text-arena">Builders only</Label>
          <h1 className="mt-6 max-w-4xl text-[clamp(3.5rem,9vw,7rem)] font-semibold uppercase leading-[0.82] tracking-[-0.075em]">
            Sign in to compete
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-bone-dim">
            Spectators don&apos;t need an account. Builders sign in to manage Projects, enter Arenas, and
            read the performance they paid for.
          </p>
        </Container>
      </section>
      <Container className="py-12">
        <LoginForm next={destination} errorCode={error} />
      </Container>
    </div>
  );
}
