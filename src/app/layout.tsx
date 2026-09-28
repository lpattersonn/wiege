import type { Metadata, Viewport } from 'next';

import { ThemeSync } from '@/components/local/ThemeSync';
import { THEME_SCRIPT } from '@/components/local/theme';
import { Toaster } from '@/components/ui/Toast';
import { DEFAULT_SITE_URL, siteUrl } from '@/lib/env';

import { fontVariables } from './fonts';
import './globals.css';

function resolveSiteUrl(): URL {
  try {
    return new URL(siteUrl());
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

const DESCRIPTION =
  'Real news from the last four hours, turned into reading practice for ages 12 to 15. Tap any word you don’t know, answer a question, write back. Free, with no sign-up.';

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: {
    default: 'Wiege: real news, turned into reading practice',
    template: '%s – Wiege',
  },
  description: DESCRIPTION,
  applicationName: 'Wiege',
  generator: null,
  referrer: 'strict-origin-when-cross-origin',
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: 'website',
    siteName: 'Wiege',
    locale: 'en',
    title: 'Wiege: real news, turned into reading practice',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wiege: real news, turned into reading practice',
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Applies the on-device theme choice before first paint (DESIGN §4.2). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a
          href="#main"
          className="skip-link fixed top-3 left-4 z-100 -translate-y-24 rounded-pill bg-ink px-5 py-3 font-bold text-paper no-underline focus:translate-y-0"
        >
          Skip to content
        </a>
        {children}
        <Toaster />
        <ThemeSync />
      </body>
    </html>
  );
}
