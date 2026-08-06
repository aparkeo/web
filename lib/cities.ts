/**
 * Accesos rápidos a las ciudades gallegas (roadmap nº30, Galicia-first):
 * chips sobre el mapa que centran la vista. Coordenadas hardcodeadas
 * (centro urbano) para no depender del geocoder; el zoom es urbano para
 * que la carga por bbox traiga las plazas de la zona. El resto de España
 * sigue accesible alejando el mapa o usando la búsqueda.
 */
export interface QuickCity {
  name: string;
  lat: number;
  lon: number;
  zoom: number;
}

export const QUICK_CITIES: readonly QuickCity[] = [
  { name: 'Vigo', lat: 42.2406, lon: -8.7207, zoom: 14 },
  { name: 'A Coruña', lat: 43.3623, lon: -8.4115, zoom: 13 },
  { name: 'Santiago', lat: 42.8782, lon: -8.5448, zoom: 14 },
  { name: 'Pontevedra', lat: 42.431, lon: -8.6444, zoom: 14 },
  { name: 'Ourense', lat: 42.3358, lon: -7.8639, zoom: 14 },
  { name: 'Lugo', lat: 43.0097, lon: -7.5568, zoom: 14 },
  { name: 'Ferrol', lat: 43.4846, lon: -8.2368, zoom: 14 },
] as const;
