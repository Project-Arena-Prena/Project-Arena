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
    // Try the operator destination first. `requireAdmin` sends ordinary
    // Builders back to `/dashboard`, while administrators land where their
    // original sign-in flow intended.
    callback.searchParams.set('next', '/admin');
    return NextResponse.redirect(callback);
  }

  const phaseTwoBlocked = [
    '/dashboard/prena',
    '/admin/prena',
    '/api/prena',
    '/api/wallet',
    '/api/rewards',
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  // The wallet harness is deliberately available to local/CI development
  // servers and excluded from production builds by next.config.mjs. Keep a
  // second production-only guard here as defense in depth without making the
  // browser suite test a permanent 404 page.
  const devHarnessBlocked =
    process.env.NODE_ENV === 'production' &&
    ['/dev-wallet-harness', '/dev-founding-harness'].some((prefix) => path === prefix || path.startsWith(prefix + '/'));

  if (phaseTwoBlocked || devHarnessBlocked) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // An unconfigured preview is unauthenticated, but still preserves the
  // requested destination rather than letting the dashboard layout replace it.
  if (!url || !anonKey) {
    if (['/dashboard', '/admin'].some((prefix) => path === prefix || path.startsWith(prefix + '/'))) {
      const login = request.nextUrl.clone();
      login.pathname = '/login';
      login.search = '';
      login.searchParams.set('next', path + request.nextUrl.search);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookiesToSet, cacheHeaders: Record<string, string>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(cacheHeaders).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  if (['/dashboard', '/admin'].some((prefix) => path === prefix || path.startsWith(prefix + '/')) && !isAuthenticated) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    login.searchParams.set('next', path + request.nextUrl.search);
    const redirect = NextResponse.redirect(login);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set('Cache-Control', 'private, no-store');
    return redirect;
  }

  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|api/cron/reconcile|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|ico|woff2?)$).*)',
  ],
};

