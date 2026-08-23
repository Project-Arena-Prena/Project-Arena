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

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
