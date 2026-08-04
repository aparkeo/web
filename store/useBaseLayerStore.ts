import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Capa base del mapa: "map" = CARTO temático (Voyager/Dark Matter según el tema),
// "satellite" = Esri World Imagery + etiquetas de referencia (sin variante de tema:
// las fotos aéreas son las fotos).
export type BaseLayer = 'map' | 'satellite';

interface BaseLayerState {
  baseLayer: BaseLayer;
  setBaseLayer: (baseLayer: BaseLayer) => void;
}

export const useBaseLayerStore = create<BaseLayerState>()(
  persist(
    (set) => ({
      baseLayer: 'map',
      setBaseLayer: (baseLayer) => set({ baseLayer }),
    }),
    {
      name: 'minusvigo-baselayer',
      storage: createJSONStorage(() => localStorage),
      // Solo se persiste la capa elegida; nada más que guardar en este store.
      partialize: (s) => ({ baseLayer: s.baseLayer }),
    },
  ),
);
