/**
 * Content-Security-Policy — fuente única de verdad.
 *
 * `next.config.ts` sirve la cabecera y los tests unitarios la verifican
 * importando estas funciones, así que política servida y política testeada
 * nunca divergen.
 *
 * Historia: fase report-only el 04-08-2026 (roadmap nº3 de
 * docs/AUDIT-2026-07-31.md); endurecida a ENFORCE el 05-08-2026 tras ~1 día
 * en producción sin violaciones inesperadas.
 *
 * Decisiones:
 * - script-src 'unsafe-inline': next-themes inyecta un script inline
 *   anti-FOUC y Next.js App Router inyecta scripts inline de hidratación/RSC;
 *   sin un sistema de nonces por request (nada trivial en App Router con
 *   NextAuth + streaming) no hay alternativa realista. Documentado como
 *   riesgo aceptado; un nonce por middleware rompería el cacheo estático y
 *   exigiría propagarlo a todos los scripts de Next.
 * - En DESARROLLO se añade 'unsafe-eval' a script-src: el dev server de
 *   Next (React Refresh / HMR con sourcemaps tipo eval) lo necesita. La
 *   política de producción NO lo incluye.
 * - style-src 'unsafe-inline': Tailwind/shadcn/React Leaflet generan
 *   atributos style inline (posicionamiento del mapa, divIcons, recharts).
 * - img-src: tiles OpenStreetMap estándar (capa temática clara/oscura; el
 *   modo oscuro se logra con filtro CSS sobre los mismos tiles, sin API
 *   key — CARTO pasó a exigirla y devolvía watermark "API KEY REQUIRED"),
 *   satélite Esri (World Imagery + etiquetas de referencia) y fotos de
 *   plazas en Supabase Storage (bucket público spot-photos); data: y blob:
 *   los usa Leaflet para markers/previews y el cliente para previsualizar
 *   fotos antes de subirlas.
 * - connect-src 'self' + Supabase (https REST y wss Realtime): el feed en
 *   tiempo real abre wss://<proyecto>.supabase.co/realtime. No hay Vercel
 *   Analytics ni Speed Insights instalados (no se añaden orígenes de
 *   terceros que no se usan). Web Push usa PushManager del navegador, fuera
 *   del alcance de la CSP.
 * - upgrade-insecure-requests: solo en producción (https). Los navegadores
 *   eximen localhost del upgrade, pero no tiene sentido servirla en dev.
 * - report-uri /api/csp-report: endpoint propio que loguea violaciones
 *   (visibles en Vercel logs). Sin `report-to`/Reporting-Endpoints: report-uri
 *   sigue siendo lo más compatible y suficiente para volumen bajo.
 */

export const CSP_HEADER_NAME = 'Content-Security-Policy';

/** Ruta del endpoint que recibe los reportes de violación. */
export const CSP_REPORT_PATH = '/api/csp-report';

export function buildContentSecurityPolicy(options?: { isDev?: boolean }): string {
  const isDev = options?.isDev ?? process.env.NODE_ENV !== 'production';

  const scriptSrc = ["script-src 'self' 'unsafe-inline'"];
  if (isDev) scriptSrc.push("'unsafe-eval'");

  const directives = [
    "default-src 'self'",
    scriptSrc.join(' '),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://server.arcgisonline.com https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `report-uri ${CSP_REPORT_PATH}`,
  ];

  if (!isDev) directives.push('upgrade-insecure-requests');

  return directives.join('; ');
}
