import type { RouteResult } from '@/app/api/route/route';

export interface RouteEndpoint {
  lat: number;
  lon: number;
}

/**
 * Ruta en coche entre dos puntos, calculada por /api/route (proxy OSRM).
 * Se usa para el «Cómo llegar» integrado en el mapa de Aparkeo.
 */
export async function fetchDrivingRoute(
  from: RouteEndpoint,
  to: RouteEndpoint,
): Promise<RouteResult> {
  const params = new URLSearchParams({
    fromLat: String(from.lat),
    fromLon: String(from.lon),
    toLat: String(to.lat),
    toLon: String(to.lon),
  });
  const res = await fetch(`/api/route?${params.toString()}`);
  if (!res.ok) throw new Error('No se pudo calcular la ruta');
  return res.json();
}
