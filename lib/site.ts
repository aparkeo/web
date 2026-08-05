// Identidad pública del sitio: única fuente de verdad para metadata, OG,
// sitemap, robots y JSON-LD. NEXT_PUBLIC_SITE_URL permite override por entorno.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://minusvigo-web.vercel.app';
export const SITE_NAME = 'MinusVigo';
export const SITE_TAGLINE = 'Plazas PMR libres en Vigo, en tiempo real';
export const SITE_DESCRIPTION =
  'Encuentra plazas de aparcamiento PMR libres en Vigo en tiempo real. Mapa, predicciones inteligentes y reportes de la comunidad.';
