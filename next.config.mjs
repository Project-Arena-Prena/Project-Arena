/**
 * `dev.tsx` is a page extension only outside production. The wallet test
 * harness at src/app/dev-wallet-harness is named page.dev.tsx, so a production
 * build sees no page file there and the route cannot be reached.
 *
 * It has to come first: Next strips the extension with an alternation anchored
 * at the end of the filename, so a plain `tsx` earlier in the list would eat
 * only the tail and route the harness as `/dev-wallet-harness/page.dev`.
 */
const pageExtensions = ['tsx', 'ts', 'jsx', 'js'];
if (process.env.NODE_ENV !== 'production') pageExtensions.unshift('dev.tsx');

const isProductionDeployment = process.env.VERCEL_ENV === 'production';
if (isProductionDeployment) {
  const groups = [
    ['NEXT_PUBLIC_SUPABASE_URL'],
    ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    ['STRIPE_SECRET_KEY'],
    ['STRIPE_WEBHOOK_SECRET'],
    ['NEXT_PUBLIC_SITE_URL'],
    ['ADMIN_EMAILS'],
    ['CRON_SECRET'],
    ['FRAUD_SALT'],
  ];
  const missing = groups.filter((names) => !names.some((name) => process.env[name]?.trim())).map((names) => names.join('|'));
  if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(', ')}`);

  const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL);
  if (siteUrl.protocol !== 'https:' || siteUrl.origin !== process.env.NEXT_PUBLIC_SITE_URL) {
    throw new Error('NEXT_PUBLIC_SITE_URL must be an HTTPS origin without a trailing slash or path.');
  }
  if (process.env.STRIPE_SECRET_KEY?.includes('_test_')) {
    throw new Error('Production deployments cannot use a Stripe test key.');
  }
}

const securityHeaders = [
  { key: 'Content-Security-Policy', value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; font-src 'self' data:; upgrade-insecure-requests` },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions,
  agentRules: false,
  ...(process.env.NODE_ENV !== 'production' ? { allowedDevOrigins: ['127.0.0.1'] } : {}),
  // `npm run build` runs the stricter app + test typecheck before Next starts.
  typescript: { ignoreBuildErrors: true },
  experimental: { useTypeScriptCli: false },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
