import { describe, expect, it } from 'vitest';
import { dedupeSpotsByProximity, DEDUP_RADIUS_M } from '@/lib/dedupeSpots';

interface TestSpot {
  id: number;
  lat: number;
  lon: number;
  source?: string | null;
}

// Coordenadas reales aproximadas de una plaza PMR en Vigo.
const VIGO = { lat: 42.2406, lon: -8.7207 };
// ~10 m al este (0.00012° de longitud a lat 42° ≈ 10 m).
const NEAR = { lat: 42.2406, lon: -8.72058 };
// ~200 m al norte, fuera del radio de deduplicación.
const FAR = { lat: 42.2424, lon: -8.7207 };

const official = (id: number, coords = VIGO): TestSpot => ({ id, ...coords, source: 'vigo-opendata' });
const osm = (id: number, coords = NEAR): TestSpot => ({ id, ...coords, source: 'osm' });

describe('dedupeSpotsByProximity (duplicados Vigo-oficial vs OSM)', () => {
  it('usa un radio de ~15 m', () => {
    expect(DEDUP_RADIUS_M).toBe(15);
  });

  it('descarta el duplicado OSM a <15 m de un oficial y conserva el oficial', () => {
    const spots = [official(1), osm(20_000_001)];
    const result = dedupeSpotsByProximity(spots);
    expect(result.map((s) => s.id)).toEqual([1]);
  });

  it('el orden de entrada no importa: el oficial siempre gana', () => {
    const spots = [osm(20_000_001), official(1)];
    const result = dedupeSpotsByProximity(spots);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('vigo-opendata');
  });

  it('conserva spots OSM sin oficial cerca', () => {
    const spots = [osm(20_000_001), osm(20_000_002, FAR)];
    expect(dedupeSpotsByProximity(spots)).toHaveLength(2);
  });

  it('conserva un OSM a más de 15 m del oficial (plaza distinta)', () => {
    const spots = [official(1), osm(20_000_001, FAR)];
    expect(dedupeSpotsByProximity(spots)).toHaveLength(2);
  });

  it('no deduplica entre oficiales ni entre OSM aunque estén a <15 m', () => {
    const spots = [official(1), official(2, NEAR), osm(20_000_001, FAR), osm(20_000_002, { lat: FAR.lat, lon: FAR.lon + 0.0001 })];
    // Los dos oficiales cercanos se conservan (pueden ser plazas adyacentes
    // reales); el segundo OSM está lejos del oficial y también se conserva.
    const result = dedupeSpotsByProximity(spots);
    expect(result.map((s) => s.id)).toEqual([1, 2, 20_000_001, 20_000_002]);
  });

  it('un solo oficial cubre varios duplicados OSM alrededor', () => {
    const spots = [
      official(1),
      osm(20_000_001),
      osm(20_000_002, { lat: VIGO.lat - 0.0001, lon: VIGO.lon }), // ~11 m al sur
      osm(20_000_003, FAR),
    ];
    const result = dedupeSpotsByProximity(spots);
    expect(result.map((s) => s.id)).toEqual([1, 20_000_003]);
  });

  it('los spots sin source (legado) no se descartan nunca', () => {
    const legacy: TestSpot = { id: 3, ...NEAR, source: null };
    const spots = [official(1), legacy];
    expect(dedupeSpotsByProximity(spots)).toHaveLength(2);
  });

  it('sin oficiales devuelve la lista intacta', () => {
    const spots = [osm(20_000_001), osm(20_000_002)];
    expect(dedupeSpotsByProximity(spots)).toBe(spots);
  });
});
