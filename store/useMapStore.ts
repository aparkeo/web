import { create } from 'zustand';
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

// Vista inicial por defecto: España completa (roadmap nº29). Si el usuario
// concede geolocalización, RecenterOnUser centra en su posición como antes.
const SPAIN_CENTER: [number, number] = [40.3, -3.7];
const SPAIN_ZOOM = 6;

export const useMapStore = create<MapState>((set) => ({
  selectedSpotId: null,
  userLocation: null,
  center: SPAIN_CENTER,
  zoom: SPAIN_ZOOM,
  bbox: null,
  setSelectedSpot: (id) => set({ selectedSpotId: id }),
  setUserLocation: (loc) => set({ userLocation: loc }),
  setCenter: (center, zoom) => set((s) => ({ center, zoom: zoom ?? s.zoom })),
  setBbox: (bbox) => set({ bbox }),
}));
