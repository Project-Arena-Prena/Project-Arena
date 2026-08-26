import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookiesToSet = { name: string; value: string; options: CookieOptions }[];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Supabase falls back to SITE_URL when an environment-specific callback is
  // missing from its redirect allowlist. Preserve the one-time credential and
  // send that fallback through the real callback handler instead of rendering
  // the public homepage and silently dropping the sign-in attempt.
  if (
    path === '/' &&
    (request.nextUrl.searchParams.has('code') || request.nextUrl.searchParams.has('token_hash'))
  ) {
    const callback = request.nextUrl.clone();
    callback.pathname = '/auth/callback';
    callback.searchParams.set('next', '/dashboard');
    return NextResponse.redirect(callback);
  }

  const phaseTwoBlocked = [
    '/dashboard/prena',
    '/admin/prena',
    '/api/prena',
    '/api/wallet',
    '/api/rewards',
    '/dev-wallet-harness',
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  if (phaseTwoBlocked) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fixture mode: no Supabase, nothing to refresh.
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  if (path.startsWith('/dashboard') && !isAuthenticated) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.searchParams.set('next', path);
    return NextResponse.redirect(login);
  }
  if (path.startsWith('/admin') && !isAuthenticated) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.searchParams.set('next', path);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|api/cron/reconcile|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
