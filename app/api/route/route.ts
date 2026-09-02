import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getClientIp, rateLimit } from '@/lib/rateLimit';

const QuerySchema = z.object({
  fromLat: z.coerce.number().min(-90).max(90),
  fromLon: z.coerce.number().min(-180).max(180),
  toLat: z.coerce.number().min(-90).max(90),
  toLon: z.coerce.number().min(-180).max(180),
});

export interface RouteResult {
  /** Pares [lat, lon] listos para Leaflet (OSRM devuelve [lon, lat]). */
  path: [number, number][];
  distanceM: number;
  durationS: number;
}

interface OsrmResponse {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }[];
}

/**
 * Proxy a OSRM (router.project-osrm.org) para el «Cómo llegar» DENTRO de
 * Aparkeo: dibuja la ruta en coche sobre el propio mapa en vez de mandar al
 * usuario a Google Maps. Server-side para no depender del CORS del servidor
 * de demo, limitar por IP y poder cambiar de motor (OSRM propio, Valhalla…)
 * sin tocar el cliente. La geometría se cachea 5 min por par origen/destino.
 */
export async function GET(req: NextRequest) {
  const { success, retryAfterSec } = await rateLimit(`route:${getClientIp(req)}`, 30, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: 'Demasiadas rutas. Inténtalo de nuevo en unos segundos.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    fromLat: searchParams.get('fromLat'),
    fromLon: searchParams.get('fromLon'),
    toLat: searchParams.get('toLat'),
    toLon: searchParams.get('toLon'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros de ruta no válidos' }, { status: 400 });
  }
  const { fromLat, fromLon, toLat, toLon } = parsed.data;

  const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AparkeoWeb/1.0 (contacto: hola@aparkeo.com)' },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);

    const data = (await res.json()) as OsrmResponse;
    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route) {
      return NextResponse.json({ error: 'No se encontró una ruta en coche' }, { status: 404 });
    }

    const result: RouteResult = {
      path: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
      distanceM: route.distance,
      durationS: route.duration,
    };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'No se pudo calcular la ruta' }, { status: 502 });
  }
}
