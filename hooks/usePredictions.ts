import { useQuery } from '@tanstack/react-query';
import { fetchPrediction } from '@/services/predictions';

export function usePrediction(spotId: number | null) {
  return useQuery({
    queryKey: ['prediction', spotId],
    queryFn: () => fetchPrediction(spotId!),
    enabled: spotId !== null,
    staleTime: 60_000,
  });
}
