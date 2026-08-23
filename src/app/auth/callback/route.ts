import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = url.searchParams.get('next') ?? '/dashboard';
  const origin = url.origin;
  const destination = next.startsWith('/') ? next : '/dashboard';

  const supabase = await createClient();
  if (supabase && code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (supabase && tokenHash) {
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: (type as 'email' | 'magiclink') || 'email',
    });
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
