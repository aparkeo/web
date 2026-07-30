import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toggleFavorite } from '@/services/spots';
import { toast } from 'sonner';

export function useFavoriteToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (spotId: number) => toggleFavorite(spotId),
    onSuccess: (data) => {
      toast.success(data.favorite ? '★ Añadida a favoritas' : 'Eliminada de favoritas');
      queryClient.invalidateQueries({ queryKey: ['spots'] });
    },
    onError: () => toast.error('Inicia sesión para guardar favoritas'),
  });
}
