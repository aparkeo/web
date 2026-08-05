import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toggleFavorite } from '@/services/spots';
import { toast } from 'sonner';
import { useT } from '@/components/i18n/I18nProvider';

export function useFavoriteToggle() {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (spotId: number) => toggleFavorite(spotId),
    onSuccess: (data) => {
      toast.success(data.favorite ? t.toasts.addedFavorite : t.toasts.removedFavorite);
      queryClient.invalidateQueries({ queryKey: ['spots'] });
    },
    onError: () => toast.error(t.toasts.loginForFavorites),
  });
}
