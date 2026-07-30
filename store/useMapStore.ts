import { create } from 'zustand';
import type { UserLocation } from '@/types';

interface MapState {
  selectedSpotId: number | null;
  userLocation: UserLocation | null;
  center: [number, number];
  zoom: number;
  setSelectedSpot: (id: number | null) => void;
  setUserLocation: (loc: UserLocation | null) => void;
  setCenter: (center: [number, number], zoom?: number) => void;
}

const VIGO_CENTER: [number, number] = [42.2406, -8.7207];

export const useMapStore = create<MapState>((set) => ({
  selectedSpotId: null,
  userLocation: null,
  center: VIGO_CENTER,
  zoom: 14,
  setSelectedSpot: (id) => set({ selectedSpotId: id }),
  setUserLocation: (loc) => set({ userLocation: loc }),
  setCenter: (center, zoom) => set((s) => ({ center, zoom: zoom ?? s.zoom })),
}));
