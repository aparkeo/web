import { useQuery } from '@tanstack/react-query';
import { fetchBestSpot } from '@/services/predictions';
import { useDestinationStore } from '@/store/useDestinationStore';

/**
 * Busca la mejor plaza alrededor del DESTINO elegido, no de la ubicación
 * GPS actual del usuario — alguien planificando desde casa hacia el
 * hospital no quiere la plaza más cercana a su sofá.
 */
export function useBestSpot() {
  const destination = useDestinationStore((s) => s.destination);

  return useQuery({
    queryKey: ['best-spot', destination?.latitude, destination?.longitude, destination?.statusFilter],
    queryFn: () =>
      fetchBestSpot(
        { latitude: destination!.latitude, longitude: destination!.longitude },
        destination!.statusFilter,
      ),
    enabled: !!destination,
    refetchInterval: 30_000,
  });
}
