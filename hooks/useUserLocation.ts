'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useMapStore } from '@/store/useMapStore';
import { useT } from '@/components/i18n/I18nProvider';
import type { Dictionary } from '@/lib/i18n';

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

function errorMessage(err: GeolocationPositionError, t: Dictionary): string {
  if (err.code === err.PERMISSION_DENIED) return t.destination.permissionDenied;
  return t.destination.locationError;
}

export function useUserLocation() {
  const setUserLocation = useMapStore((s) => s.setUserLocation);
  const [loading, setLoading] = useState(false);
  const t = useT();

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error(t.destination.geolocationUnavailable);
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
            toast.error(errorMessage(fallbackErr, t));
            setLoading(false);
          },
          LOW_ACCURACY,
        );
        return;
      }
      toast.error(errorMessage(err, t));
      setLoading(false);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onHighAccuracyError, HIGH_ACCURACY);
  }, [setUserLocation, t]);

  return { locate, loading };
}
