import type { NextConfig } from 'next';
import { buildContentSecurityPolicy, CSP_HEADER_NAME } from './lib/csp';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.openstreetmap.org' },
      { protocol: 'https', hostname: '*.tile.openstreetmap.org' },
    ],
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Evita que Next.js infiera el workspace root incorrectamente cuando hay
  // múltiples package-lock.json en rutas superiores.
  outputFileTracingRoot: process.cwd(),
  async headers() {
    // Content-Security-Policy en modo ENFORCE (P1 nº3 del roadmap de
    // docs/AUDIT-2026-07-31.md, endurecida el 05-08-2026 tras la fase
    // report-only del 04-08-2026 sin violaciones inesperadas). La política
    // vive en lib/csp.ts (fuente única compartida con los tests unitarios);
    // las violaciones se reportan a /api/csp-report y quedan en Vercel logs.
    const contentSecurityPolicy = buildContentSecurityPolicy();
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'geolocation=(self)' },
          {
            key: CSP_HEADER_NAME,
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
