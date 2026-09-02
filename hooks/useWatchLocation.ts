'use client';

import { useEffect } from 'react';
import { useMapStore } from '@/store/useMapStore';

/**
 * Seguimiento GPS en vivo (watchPosition) para el modo navegación del
 * «Cómo llegar»: mientras hay una ruta activa, la posición del usuario se
 * actualiza sola (con rumbo si el dispositivo lo informa) y el mapa la
 * sigue. Los errores se ignoran a propósito: conceder el permiso ya pasa
 * por useUserLocation.locate(), que avisa con toast si algo falla; aquí un
 * fix perdido solo significa "sigue con la última posición conocida".
 */
export function useWatchLocation(active: boolean) {
  const setUserLocation = useMapStore((s) => s.setUserLocation);

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [active, setUserLocation]);
}
