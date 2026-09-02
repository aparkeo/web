'use client';

import { useEffect } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { RouteResult } from '@/app/api/route/route';

/**
 * Dibuja la ruta en coche sobre el mapa (azul, grosor 5) y encuadra el
 * viewport para verla entera. El fitBounds dispara ViewportSync, así las
 * plazas a lo largo del camino se cargan solas al hacer el paneo.
 */
export function RouteLayer({ route }: { route: RouteResult }) {
  const map = useMap();

  useEffect(() => {
    if (route.path.length < 2) return;
    map.fitBounds(L.latLngBounds(route.path), { padding: [56, 56] });
  }, [route, map]);

  if (route.path.length < 2) return null;

  return (
    <Polyline
      positions={route.path}
      pathOptions={{ color: '#2563EB', weight: 5, opacity: 0.85 }}
    />
  );
}
