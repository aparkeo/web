import { es } from '@/lib/i18n';
import { fmt } from '@/lib/i18n/format';

/**
 * Mensajes para regiones aria-live (lectores de pantalla).
 * Centralizados para mantener un lenguaje consistente y testeable.
 *
 * Los textos viven en los diccionarios i18n (`t.a11y`); el parámetro es
 * opcional y por defecto usa el español, así los tests y llamadores antiguos
 * siguen funcionando sin cambios.
 */

export type A11yAnnouncements = typeof es.a11y;

/** Anuncia cuántas plazas se muestran tras cargar o filtrar (mapa y reporte). */
export function spotsCountAnnouncement(count: number, strings: A11yAnnouncements = es.a11y): string {
  if (count === 0) return strings.noSpotsMatch;
  if (count === 1) return strings.oneSpotShown;
  return fmt(strings.spotsShown, { n: count });
}

/** Anuncia el resultado de la búsqueda de destino (geocoding). */
export function geocodeResultsAnnouncement(count: number, strings: A11yAnnouncements = es.a11y): string {
  if (count === 0) return strings.noGeocodeResults;
  if (count === 1) return strings.oneGeocodeResult;
  return fmt(strings.geocodeResults, { n: count });
}
