import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeInternalPath } from '@/lib/validation';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = url.searchParams.get('next') ?? '/dashboard';
  const origin = url.origin;
  const destination = safeInternalPath(next, '/dashboard');

  const supabase = await createClient();
  let error: unknown = null;
  if (supabase && code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (supabase && tokenHash) {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: (type as 'email' | 'magiclink') || 'email',
    }));
  } else {
    error = new Error('missing_auth_token');
  }

  if (error) {
    // The redirect can only carry a generic code, and a consumed link, an
    // expired one and a PKCE cookie-origin mismatch are indistinguishable
    // without this. Server-side only — never surfaced to the visitor.
    console.error('[auth/callback]', error);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }
  return NextResponse.redirect(`${origin}${destination}`);
}
