// Identidad pública del sitio: única fuente de verdad para metadata, OG,
// sitemap, robots y JSON-LD. NEXT_PUBLIC_SITE_URL permite override por entorno.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://minusvigo-web.vercel.app';
export const SITE_NAME = 'Aparkeo';
export const SITE_TAGLINE = 'Plazas PMR en vivo';
export const SITE_DESCRIPTION =
  'Aparkeo: encuentra plazas de aparcamiento PMR libres en Galicia y toda España en tiempo real. Mapa, predicciones inteligentes y reportes de la comunidad. Hecho en Galicia.';
// Repositorio público del proyecto: vía de contacto con el mantenedor y
// canal para ejercer derechos RGPD (no hay entidad legal detrás).
export const SITE_GITHUB_URL = 'https://github.com/adrianalvarezfreire11/minusvigo-web';
