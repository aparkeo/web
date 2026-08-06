/**
 * Accesos rápidos a ciudades principales (roadmap nº29): chips sobre el
 * mapa que centran la vista. Coordenadas hardcodeadas (centro urbano) para
 * no depender del geocoder; el zoom es urbano para que la carga por bbox
 * traiga las plazas de la zona.
 */
export interface QuickCity {
  name: string;
  lat: number;
  lon: number;
  zoom: number;
}

export const QUICK_CITIES: readonly QuickCity[] = [
  { name: 'Vigo', lat: 42.2406, lon: -8.7207, zoom: 14 },
  { name: 'Madrid', lat: 40.4168, lon: -3.7038, zoom: 12 },
  { name: 'Barcelona', lat: 41.3874, lon: 2.1686, zoom: 12 },
  { name: 'Valencia', lat: 39.4699, lon: -0.3763, zoom: 13 },
  { name: 'Sevilla', lat: 37.3891, lon: -5.9845, zoom: 13 },
  { name: 'Bilbao', lat: 43.263, lon: -2.935, zoom: 13 },
  { name: 'A Coruña', lat: 43.3623, lon: -8.4115, zoom: 13 },
  { name: 'Santiago', lat: 42.8782, lon: -8.5448, zoom: 14 },
] as const;
