import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignInPanel } from '@/components/auth/sign-in-panel';
import { Container } from '@/components/ui';
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

  return <Container className="sign-in-page"><SignInPanel next={destination} errorCode={error} /></Container>;
}
