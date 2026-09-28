import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

/** SPEC §9. No script-src CSP: static pages cannot carry per-request nonces. */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Only over HTTPS in production; locally it would pin localhost to HTTPS.
  ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Node-only database drivers: load with native require instead of bundling.
  serverExternalPackages: ['postgres', 'embedded-postgres'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
