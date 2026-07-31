import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markNotificationsRead } from '@/services/notifications';
import type { MarkNotificationsReadInput, NotificationsResponse } from '@/types';

/**
 * Marca notificaciones como leídas con actualización optimista de la caché:
 * el badge y el fondo de "no leída" reaccionan al instante y, si la API
 * falla, se restaura el estado previo. Al terminar se invalida para
 * reconciliar con el servidor.
 */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MarkNotificationsReadInput) => markNotificationsRead(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData<NotificationsResponse>(['notifications']);

      queryClient.setQueryData<NotificationsResponse>(['notifications'], (old) => {
        if (!old) return old;
        if (payload.all) {
          return {
            notifications: old.notifications.map((n) => ({ ...n, read: true })),
            unreadCount: 0,
          };
        }
        const wasUnread = old.notifications.some((n) => n.id === payload.id && !n.read);
        return {
          notifications: old.notifications.map((n) => (n.id === payload.id ? { ...n, read: true } : n)),
          unreadCount: wasUnread ? Math.max(0, old.unreadCount - 1) : old.unreadCount,
        };
      });

      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notifications'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
