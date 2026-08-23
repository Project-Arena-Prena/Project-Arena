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
      <section className="border-b hairline">
        <Container className="py-14 sm:py-20">
          <Label>Builders only</Label>
          <h1 className="mt-6 max-w-3xl text-[42px] font-semibold leading-[0.9] tracking-headline sm:text-6xl">
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
