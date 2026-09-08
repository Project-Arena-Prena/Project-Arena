import type { Metadata, Viewport } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { SessionProvider } from '@/components/auth/session-provider';
import { getSessionUser } from '@/lib/supabase/server';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Project Arena — Where projects compete for attention',
    template: '%s — Project Arena',
  },
  description: 'Discover. Compete. Get seen. Internet projects compete in live, timed Arenas for attention, clicks, and reputation.',
  openGraph: {
    title: 'Project Arena',
    description: 'Where projects compete for attention.',
    type: 'website',
    images: ['/og.png'],
  },
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen">
        <SessionProvider initialUser={user ? { id: user.id, email: user.email } : null}>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1}>{children}</main>
        <SiteFooter />
        </SessionProvider>
      </body>
    </html>
  );
}
