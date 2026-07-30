import type { GeocodeResult } from '@/types';

export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('No se pudo buscar la dirección');
  return res.json();
}
