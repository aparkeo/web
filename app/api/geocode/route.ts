import { NextRequest, NextResponse } from 'next/server';

// Mismo centro/radio que usa la app móvil (src/utils/vigoBounds.ts) para
// sesgar las búsquedas hacia Vigo sin tener que mantener dos definiciones.
const VIGO_CENTER = { lat: 42.2406, lon: -8.7207 };
const PAD_DEG = 0.15; // ~14 km

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
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json([]);
  }

  const viewbox = [
    VIGO_CENTER.lon - PAD_DEG,
    VIGO_CENTER.lat + PAD_DEG,
    VIGO_CENTER.lon + PAD_DEG,
    VIGO_CENTER.lat - PAD_DEG,
  ].join(',');

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('viewbox', viewbox);
  url.searchParams.set('bounded', '1');
  url.searchParams.set('countrycodes', 'es');

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MinusVigoWeb/1.0 (contacto: admin@minusvigo.dev)' },
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
