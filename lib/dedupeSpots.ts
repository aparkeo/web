import { distanceMeters } from '@/lib/utils';

/**
 * Deduplicación visual de duplicados físicos Vigo-oficial vs OSM (roadmap
 * nº29): tras la importación nacional de OSM puede haber dos registros del
 * mismo aparcamiento — el oficial del Concello (source='vigo-opendata') y el
 * de OpenStreetMap (source='osm') — con coordenadas casi idénticas.
 *
 * Regla deliberadamente conservadora: SOLO se descarta un spot de OSM cuando
 * cae a menos de `radiusM` de un spot oficial. Dos oficiales o dos de OSM a
 * 10 m se conservan (pueden ser plazas distintas y adyacentes).
 *
 * Es una capa de presentación: la DB conserva ambos registros.
 */

export const DEDUP_RADIUS_M = 15;

const OFFICIAL_SOURCE = 'vigo-opendata';
const OSM_SOURCE = 'osm';

interface Coords {
  lat: number;
  lon: number;
  source?: string | null;
}

export function dedupeSpotsByProximity<T extends Coords>(spots: T[], radiusM = DEDUP_RADIUS_M): T[] {
  // Rejilla de ~radiusM de lado para que la búsqueda de vecinos sea O(1)
  // por spot en vez de O(n) (el viewport puede traer >1000 plazas).
  const cellDeg = radiusM / 111_320; // grados de latitud por celda
  const officialGrid = new Map<string, T[]>();

  const cellOf = (lat: number, lon: number) => [Math.floor(lat / cellDeg), Math.floor(lon / cellDeg)] as const;
  const gridKey = (lat: number, lon: number) => cellOf(lat, lon).join(',');

  for (const spot of spots) {
    if (spot.source !== OFFICIAL_SOURCE) continue;
    const key = gridKey(spot.lat, spot.lon);
    const bucket = officialGrid.get(key);
    if (bucket) bucket.push(spot);
    else officialGrid.set(key, [spot]);
  }

  if (officialGrid.size === 0) return spots;

  const hasOfficialNeighbor = (spot: T): boolean => {
    const [baseLat, baseLon] = cellOf(spot.lat, spot.lon);
    // Las celdas contiguas cubren los cruces de borde de la rejilla.
    for (let dLat = -1; dLat <= 1; dLat += 1) {
      for (let dLon = -1; dLon <= 1; dLon += 1) {
        const bucket = officialGrid.get(`${baseLat + dLat},${baseLon + dLon}`);
        if (!bucket) continue;
        for (const official of bucket) {
          if (distanceMeters(spot.lat, spot.lon, official.lat, official.lon) <= radiusM) return true;
        }
      }
    }
    return false;
  };

  return spots.filter((spot) => spot.source !== OSM_SOURCE || !hasOfficialNeighbor(spot));
}
