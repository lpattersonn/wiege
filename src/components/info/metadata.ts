import type { Metadata } from 'next';

/**
 * The site-wide share image (src/app/opengraph-image.tsx). A page that sets
 * its own `openGraph` replaces the root one wholesale, and the file-based
 * image is not inherited, so the info pages reference it explicitly. (Not
 * imported from the route: that module reads font files at load time.)
 */
const SHARE_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'Wiege: real news from the last four hours, turned into reading practice for ages 12 to 15.',
} as const;

/**
 * Metadata for the info pages: title (the root template adds " – Wiege"),
 * description, canonical URL (resolved against `metadataBase`) and matching
 * Open Graph / Twitter fields. Nested objects replace the root layout's, so
 * they are rebuilt in full here.
 */
export function infoMetadata({ path, title, description }: { path: `/${string}`; title: string; description: string }): Metadata {
  const fullTitle = `${title} – Wiege`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: 'Wiege', locale: 'en', url: path, title: fullTitle, description, images: [SHARE_IMAGE] },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [SHARE_IMAGE] },
  };
}
