/**
 * Mensajes para regiones aria-live (lectores de pantalla).
 * Centralizados para mantener un lenguaje consistente y testeable.
 */

/** Anuncia cuántas plazas se muestran tras cargar o filtrar (mapa y reporte). */
export function spotsCountAnnouncement(count: number): string {
  if (count === 0) return 'Ninguna plaza coincide con los filtros.';
  if (count === 1) return 'Se muestra 1 plaza.';
  return `Se muestran ${count} plazas.`;
}

/** Anuncia el resultado de la búsqueda de destino (geocoding). */
export function geocodeResultsAnnouncement(count: number): string {
  if (count === 0) return 'Sin resultados en Vigo.';
  if (count === 1) return '1 resultado encontrado.';
  return `${count} resultados encontrados.`;
}
