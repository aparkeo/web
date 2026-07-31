'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useMapStore } from '@/store/useMapStore';

const HIGH_ACCURACY: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 30_000,
};

const LOW_ACCURACY: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 12_000,
  maximumAge: 60_000,
};

function errorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return 'Permiso de ubicación denegado.';
  return 'No se pudo obtener la ubicación.';
}

export function useUserLocation() {
  const setUserLocation = useMapStore((s) => s.setUserLocation);
  const [loading, setLoading] = useState(false);

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocalización no disponible en este dispositivo.');
      return;
    }

    setLoading(true);

    const onSuccess = (pos: GeolocationPosition) => {
      setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setLoading(false);
    };

    const onHighAccuracyError = (err: GeolocationPositionError) => {
      // Fallback a baja precisión cuando expira el timeout de alta precisión
      if (err.code === err.TIMEOUT) {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (fallbackErr) => {
            toast.error(errorMessage(fallbackErr));
            setLoading(false);
          },
          LOW_ACCURACY,
        );
        return;
      }
      toast.error(errorMessage(err));
      setLoading(false);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onHighAccuracyError, HIGH_ACCURACY);
  }, [setUserLocation]);

  return { locate, loading };
}
