import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Destination } from '@/types';

interface DestinationState {
  destination: Destination | null;
  setDestination: (destination: Destination | null) => void;
}

export const useDestinationStore = create<DestinationState>()(
  persist(
    (set) => ({
      destination: null,
      setDestination: (destination) => set({ destination }),
    }),
    {
      name: 'minusvigo-destination',
      storage: createJSONStorage(() => localStorage),
      // Solo se persiste el destino elegido; ubicación del usuario y
      // resultados transitorios de geocoding quedan fuera.
      partialize: (s) => ({ destination: s.destination }),
    },
  ),
);
