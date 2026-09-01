import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Bbox, UserLocation } from '@/types';

interface MapState {
  selectedSpotId: number | null;
  userLocation: UserLocation | null;
  center: [number, number];
  zoom: number;
  /** Viewport actual del mapa (ya con padding), base de la carga por bbox. */
  bbox: Bbox | null;
  setSelectedSpot: (id: number | null) => void;
  setUserLocation: (loc: UserLocation | null) => void;
  setCenter: (center: [number, number], zoom?: number) => void;
  setBbox: (bbox: Bbox | null) => void;
}

// Vista inicial por defecto: Galicia completa (roadmap nº30, posicionamiento
// Galicia-first). Los datos nacionales siguen ahí: al alejar el mapa la carga
// por viewport los trae igual que antes. Si el usuario concede
// geolocalización, RecenterOnUser centra en su posición como hasta ahora.
const GALICIA_CENTER: [number, number] = [42.65, -8.0];
const GALICIA_ZOOM = 8;

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      selectedSpotId: null,
      userLocation: null,
      center: GALICIA_CENTER,
      zoom: GALICIA_ZOOM,
      bbox: null,
      setSelectedSpot: (id) => set({ selectedSpotId: id }),
      setUserLocation: (loc) => set({ userLocation: loc }),
      setCenter: (center, zoom) => set((s) => ({ center, zoom: zoom ?? s.zoom })),
      setBbox: (bbox) => set({ bbox }),
    }),
    {
      // Solo se persiste el viewport (center+zoom): al volver a la app el mapa
      // se abre donde lo dejó el usuario. Selección, ubicación GPS y bbox son
      // efímeros por diseño.
      name: 'aparkeo-map-viewport',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ center: s.center, zoom: s.zoom }),
    },
  ),
);
