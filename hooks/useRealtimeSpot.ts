'use client';

/**
 * Suscripción en tiempo real al detalle de una plaza: estado, fotos y
 * comentarios.
 *
 * Un único canal por plaza con tres listeners postgres_changes filtrados en
 * servidor (filter: id=eq.{spotId} / spotId=eq.{spotId}); cada evento
 * invalida solo la query key correspondiente y React Query refetchea:
 *   parking_spots  → ['spot', spotId]
 *   spot_photos    → ['spotPhotos', spotId]
 *   spot_comments  → ['spotComments', spotId]
 *
 * Devuelve `live` (true cuando el canal está SUBSCRIBED) para el indicador
 * «En directo». Si Realtime no conecta, el hook es un no-op silencioso y la
 * app sigue funcionando con el polling de useSpot.
 */
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseRealtime } from '@/lib/realtime';

export function useRealtimeSpot(spotId: number): boolean {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseRealtime();
    if (!supabase) return;

    const channel = supabase
      .channel(`spot:${spotId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parking_spots', filter: `id=eq.${spotId}` },
        () => queryClient.invalidateQueries({ queryKey: ['spot', spotId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'spot_photos', filter: `spotId=eq.${spotId}` },
        () => queryClient.invalidateQueries({ queryKey: ['spotPhotos', spotId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'spot_comments', filter: `spotId=eq.${spotId}` },
        () => queryClient.invalidateQueries({ queryKey: ['spotComments', spotId] }),
      )
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[realtime] Canal de plaza ${spotId}: ${status} (la app sigue en polling).`);
        }
      });

    return () => {
      setLive(false);
      supabase.removeChannel(channel);
    };
  }, [queryClient, spotId]);

  return live;
}
