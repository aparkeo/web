import { useQuery } from '@tanstack/react-query';
import { fetchDrivingRoute, type RouteEndpoint } from '@/services/route';

/**
 * Ruta en coche origen → destino con React Query: se cachea 5 min por par
 * de puntos (misma cadencia que el proxy /api/route) y solo se pide cuando
 * hay GPS del usuario Y plaza de destino.
 */
export function useRoute(from: RouteEndpoint | null, to: RouteEndpoint | null) {
  return useQuery({
    queryKey: ['route', from?.lat, from?.lon, to?.lat, to?.lon],
    queryFn: () => fetchDrivingRoute(from as RouteEndpoint, to as RouteEndpoint),
    enabled: from !== null && to !== null,
    staleTime: 300_000,
    retry: 1,
  });
}
