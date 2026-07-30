import { create } from 'zustand';
import type { Destination } from '@/types';

interface DestinationState {
  destination: Destination | null;
  setDestination: (destination: Destination | null) => void;
}

export const useDestinationStore = create<DestinationState>((set) => ({
  destination: null,
  setDestination: (destination) => set({ destination }),
}));
