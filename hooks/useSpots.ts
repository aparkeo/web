import { useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { fetchSpots } from '@/services/spots';
import { useFilterStore } from '@/store/useFilterStore';
import { useMapStore } from '@/store/useMapStore';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export function useSpots() {
  const { status, search, favoritesOnly } = useFilterStore(
    useShallow((s) => ({ status: s.status, search: s.search, favoritesOnly: s.favoritesOnly })),
  );
  const userLocation = useMapStore((s) => s.userLocation);

  // Debounce del término de búsqueda antes de usarlo en queryKey/queryFn
  const debouncedSearch = useDebouncedValue(search, 350);

  // Redondeo a 3 decimales (~111 m) para no generar entradas de caché infinitas
  const latitude = userLocation ? Number(userLocation.latitude.toFixed(3)) : undefined;
  const longitude = userLocation ? Number(userLocation.longitude.toFixed(3)) : undefined;

  return useQuery({
    queryKey: ['spots', status, debouncedSearch, latitude, longitude],
    queryFn: () =>
      fetchSpots({
        status,
        search: debouncedSearch,
        latitude,
        longitude,
      }),
    select: (spots) => (favoritesOnly ? spots.filter((s) => s.isFavorite) : spots),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
