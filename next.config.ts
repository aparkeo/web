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
    // Content-Security-Policy en modo REPORT-ONLY (P1 nº3 del roadmap de
    // docs/AUDIT-2026-07-31.md): el navegador reporta violaciones en consola
    // sin bloquear nada. Endurecer a `Content-Security-Policy` (enforce) tras
    // 1-2 semanas sin violaciones inesperadas en producción.
    //
    // Decisiones:
    // - script-src 'unsafe-inline': next-themes inyecta un script inline
    //   anti-FOUC y Next.js App Router inyecta varios scripts inline de
    //   hidratación; sin un sistema de nonces por request no hay alternativa
    //   realista. TODO futuro: endurecer con nonce (middleware) y eliminar
    //   'unsafe-inline'.
    // - style-src 'unsafe-inline': Tailwind/shadcn/React Leaflet generan
    //   atributos style inline (p. ej. posicionamiento del mapa y divIcons).
    // - img-src: tiles CARTO (Voyager + Dark Matter), satélite Esri y fotos
    //   de plazas en Supabase Storage (bucket público spot-photos); data:
    //   y blob: los usa Leaflet para markers/previews.
    // - connect-src 'self' + Supabase (https REST y wss Realtime): el
    //   geocoding (Nominatim) va server-side vía /api/geocode y Web Push usa
    //   PushManager del navegador (la entrega FCM la gestiona el SO/navegador,
    //   no pasa por la CSP de la página); el feed en tiempo real abre un
    //   websocket wss://<proyecto>.supabase.co/realtime (roadmap nº14).
    // - Sin report-uri/report-to: los informes se revisan en consola durante
    //   la fase report-only; un endpoint /api/csp-report añadiría superficie
    //   de abuso (spam de reportes) sin valor real antes del enforce.
    // - upgrade-insecure-requests NO se incluye en report-only: la spec lo
    //   ignora en políticas Report-Only y Chromium loguea un error de consola
    //   por página que ensuciaría la revisión de violaciones. Añadirlo al
    //   endurecer a enforce en producción (https).
    const contentSecurityPolicy = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'geolocation=(self)' },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
