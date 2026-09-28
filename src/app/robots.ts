import type { MetadataRoute } from 'next';

import { DEFAULT_SITE_URL, siteUrl } from '@/lib/env';

/** SPEC §10: allow content pages; keep the API and personal (on-device) pages out. */
export default function robots(): MetadataRoute.Robots {
  let base = DEFAULT_SITE_URL;
  try {
    base = siteUrl();
  } catch {
    // Invalid environment: fall back to the default origin rather than failing the route.
  }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/settings', '/journal', '/words', '/me', '/styleguide'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
