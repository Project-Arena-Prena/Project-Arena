import type { Metadata, Viewport } from 'next';
import { ArenaEnvironment } from '@/components/experience/arena-environment';
import { ScrollProgress } from '@/components/experience/scroll-progress';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Project Arena | Where projects compete for attention',
    template: '%s | Project Arena',
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
  themeColor: '#050403',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <ArenaEnvironment />
        <ScrollProgress />
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="relative z-10">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
