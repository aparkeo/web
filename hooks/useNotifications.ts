import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { fetchNotifications } from '@/services/notifications';

/**
 * Notificaciones del usuario autenticado. Se desactiva sin sesión (la API
 * devuelve 401) y se refresca cada 60 s para que el badge del Navbar se
 * actualice solo cuando una plaza favorita queda libre.
 */
export function useNotifications() {
  const { status } = useSession();

  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    enabled: status === 'authenticated',
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
