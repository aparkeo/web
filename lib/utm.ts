// ---------------------------------------------------------------------------
// Tracking de visitas por canal UTM (difusión con QRs y enlaces).
//
// Vercel Analytics no desglosa UTM, así que la medición es propia: el cliente
// (components/UtmTracker.tsx) captura los parámetros de la URL y los envía a
// POST /api/track, que los guarda como evento `utm_visit` (metadata JSON,
// sin userId ni IP — privacidad por diseño). El panel /analytics agrega por
// `metadata->>'source'` en base de datos.
//
// Formato conservador: minúsculas, dígitos, guion y guion bajo, 1-40 chars.
// Es el formato que usamos al generar los QRs/enlaces; cualquier cosa fuera
// de él (basura, intentos de inyección) se descarta en cliente y servidor.
// ---------------------------------------------------------------------------

export const UTM_VALUE_REGEX = /^[a-z0-9_-]{1,40}$/;

export interface UtmParams {
  source: string;
  medium: string | null;
  campaign: string | null;
}

/** Normaliza un valor UTM crudo: trim + minúsculas; null si no casa con el formato. */
export function normalizeUtmValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  return UTM_VALUE_REGEX.test(value) ? value : null;
}

/**
 * Extrae los UTM de una query string. Devuelve null si no hay `utm_source`
 * válido (sin source no hay nada que medir). medium/campaign son opcionales:
 * si vienen mal formados se descartan pero no invalidan la visita.
 */
export function parseUtmParams(search: string | URLSearchParams): UtmParams | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const source = normalizeUtmValue(params.get('utm_source'));
  if (!source) return null;
  return {
    source,
    medium: normalizeUtmValue(params.get('utm_medium')),
    campaign: normalizeUtmValue(params.get('utm_campaign')),
  };
}

/** Clave de dedup por sesión de navegador: una visita por combinación completa. */
export function utmSessionKey(utm: UtmParams): string {
  return `utm-tracked:${utm.source}|${utm.medium ?? ''}|${utm.campaign ?? ''}`;
}
