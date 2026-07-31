import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SpotFilters, StatusFilter } from '@/types';

interface FilterState extends SpotFilters {
  setStatus: (status: StatusFilter) => void;
  setSearch: (search: string) => void;
  toggleFavoritesOnly: () => void;
  reset: () => void;
}

const DEFAULTS: SpotFilters = { status: 'ALL', search: '', favoritesOnly: false };

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setStatus: (status) => set({ status }),
      setSearch: (search) => set({ search }),
      toggleFavoritesOnly: () => set((s) => ({ favoritesOnly: !s.favoritesOnly })),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'minusvigo-filters',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ status: s.status, search: s.search, favoritesOnly: s.favoritesOnly }),
    },
  ),
);
