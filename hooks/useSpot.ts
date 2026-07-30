import { useQuery } from '@tanstack/react-query';
import { fetchSpot } from '@/services/spots';

export function useSpot(id: number | null) {
  return useQuery({
    queryKey: ['spot', id],
    queryFn: () => fetchSpot(id!),
    enabled: id !== null,
    refetchInterval: 20_000,
  });
}
