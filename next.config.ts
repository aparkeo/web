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
};

export default nextConfig;
