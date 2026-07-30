import { useQuery } from '@tanstack/react-query';
import { fetchSpots } from '@/services/spots';
import { useFilterStore } from '@/store/useFilterStore';
import { useMapStore } from '@/store/useMapStore';

export function useSpots() {
  const { status, search, favoritesOnly } = useFilterStore();
  const userLocation = useMapStore((s) => s.userLocation);

  return useQuery({
    queryKey: ['spots', status, search, userLocation?.latitude, userLocation?.longitude],
    queryFn: () =>
      fetchSpots({
        status,
        search,
        latitude: userLocation?.latitude,
        longitude: userLocation?.longitude,
      }),
    select: (spots) => (favoritesOnly ? spots.filter((s) => s.isFavorite) : spots),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
