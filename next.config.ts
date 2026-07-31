import type { NextConfig } from 'next';

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
    // TODO: Content-Security-Policy. Los tiles de OSM (y su carga dinámica
    // desde subdominios a/b/c.tile.openstreetmap.org) complican una CSP
    // estricta de img-src/connect-src; definirla cuando se audite bien el
    // conjunto de orígenes que usa el mapa.
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'geolocation=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
