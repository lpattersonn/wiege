import type { Metadata } from 'next';

/**
 * Metadata for Today and Explore pages: title (the root template adds
 * " – Wiege"), description, canonical, and Open Graph / Twitter with the
 * site's generated image. Setting `openGraph` on a page replaces the parent's
 * object, including the file-based image, so the image is named here again.
 */
const IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'Wiege: real news from the last four hours, turned into reading practice for ages 12 to 15.',
};

export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const full = `${title} – Wiege`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: 'Wiege', locale: 'en', url: path, title: full, description, images: [IMAGE] },
    twitter: { card: 'summary_large_image', title: full, description, images: [IMAGE] },
  };
}
