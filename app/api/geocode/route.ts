import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getClientIp, rateLimit } from '@/lib/rateLimit';

const QuerySchema = z.object({
  q: z.string().trim().min(3).max(120),
});

export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
}

/**
 * Proxy a Nominatim (OSM) para autocompletar direcciones de destino.
 * Server-side porque Nominatim exige un User-Agent identificable en su
 * política de uso (no se puede garantizar desde fetch() del navegador) y
 * para poder limitar/cachear sin depender de cada cliente.
 *
 * Cobertura nacional (roadmap nº29): se restringe a España con
 * `countrycodes=es` pero SIN viewbox fijo (antes sesgaba a Vigo), así una
 * búsqueda encuentra cualquier dirección del país.
 */
export async function GET(req: NextRequest) {
  const { success, retryAfterSec } = await rateLimit(`geocode:${getClientIp(req)}`, 20, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: 'Demasiadas búsquedas. Inténtalo de nuevo en unos segundos.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({ q: searchParams.get('q') });
  if (!parsed.success) {
    return NextResponse.json([]);
  }
  const { q } = parsed.data;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'es');

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AparkeoWeb/1.0 (contacto: hola@aparkeo.com)' },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);

    const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    const results: GeocodeResult[] = data.map((r) => ({
      label: r.display_name,
      lat: Number(r.lat),
      lon: Number(r.lon),
    }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'No se pudo buscar la dirección' }, { status: 502 });
  }
}
