'use client';

/**
 * Suscripción en tiempo real a los cambios de las plazas (mapa / lista).
 *
 * Estrategia deliberadamente simple: al recibir cualquier evento
 * postgres_changes de `parking_spots` (INSERT/UPDATE/DELETE) se invalidan
 * las query keys de React Query y se deja que refetchee. No se mezclan
 * payloads a mano en la caché: la API es la única fuente de verdad y así
 * filtros/ordenación/distancias se recalculan en servidor.
 *
 * Devuelve `live` (true cuando el canal está SUBSCRIBED) para el indicador
 * visual «En directo». Si Realtime no conecta, el hook es un no-op silencioso
 * (warn en consola) y la app sigue funcionando con el polling de useSpots.
 */
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseRealtime } from '@/lib/realtime';

export function useRealtimeSpots(): boolean {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseRealtime();
    if (!supabase) return;

    const invalidateSpots = () => {
      // Prefijo: cubre todas las variantes ['spots', filtros...] y el
      // detalle ['spot', id] (los cambios de estado afectan a ambas vistas).
      queryClient.invalidateQueries({ queryKey: ['spots'] });
      queryClient.invalidateQueries({ queryKey: ['spot'] });
    };

    const channel = supabase
      .channel('public:parking_spots')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parking_spots' },
        invalidateSpots,
      )
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[realtime] Canal de plazas: ${status} (la app sigue en polling).`);
        }
      });

    return () => {
      setLive(false);
      // Cleanup correcto: suficiente para StrictMode (mount/unmount doble).
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return live;
}
