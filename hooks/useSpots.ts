import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { fetchSpots } from '@/services/spots';
import { useFilterStore } from '@/store/useFilterStore';
import { useMapStore } from '@/store/useMapStore';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface UseSpotsOptions {
  /**
   * Si es true, la query se recorta al viewport actual del mapa (bbox del
   * store). Solo lo usan las vistas del mapa; /report sigue pidiendo la
   * lista completa (comportamiento legado).
   */
  viewport?: boolean;
}

export function useSpots({ viewport = false }: UseSpotsOptions = {}) {
  const { status, search, favoritesOnly } = useFilterStore(
    useShallow((s) => ({ status: s.status, search: s.search, favoritesOnly: s.favoritesOnly })),
  );
  const userLocation = useMapStore((s) => s.userLocation);
  const bbox = useMapStore((s) => s.bbox);

  // Debounce del término de búsqueda antes de usarlo en queryKey/queryFn
  const debouncedSearch = useDebouncedValue(search, 350);

  // Redondeo a 3 decimales (~111 m) para no generar entradas de caché infinitas
  const latitude = userLocation ? Number(userLocation.latitude.toFixed(3)) : undefined;
  const longitude = userLocation ? Number(userLocation.longitude.toFixed(3)) : undefined;

  const activeBbox = viewport ? bbox : null;

  return useQuery({
    queryKey: ['spots', status, debouncedSearch, latitude, longitude, activeBbox?.join(',') ?? null],
    queryFn: () =>
      fetchSpots({
        status,
        search: debouncedSearch,
        latitude,
        longitude,
        bbox: activeBbox,
      }),
    select: (spots) => (favoritesOnly ? spots.filter((s) => s.isFavorite) : spots),
    // Al mover el mapa se mantienen las plazas del viewport anterior hasta
    // que llega la respuesta nueva: los marcadores no parpadean.
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
