import type { Bbox, SpotDTO, SpotFilters, UserLocation } from '@/types';

export async function fetchSpots(
  filters: Partial<SpotFilters & UserLocation> & { bbox?: Bbox | null } = {},
): Promise<SpotDTO[]> {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.latitude !== undefined) params.set('lat', String(filters.latitude));
  if (filters.longitude !== undefined) params.set('lon', String(filters.longitude));
  if (filters.bbox) params.set('bbox', filters.bbox.join(','));

  const res = await fetch(`/api/spots?${params.toString()}`);
  if (!res.ok) throw new Error('No se pudieron cargar las plazas');
  return res.json();
}

export async function fetchSpot(id: number): Promise<SpotDTO> {
  const res = await fetch(`/api/spots/${id}`);
  if (!res.ok) throw new Error('Plaza no encontrada');
  return res.json();
}

export async function toggleFavorite(spotId: number): Promise<{ favorite: boolean }> {
  const res = await fetch(`/api/spots/${spotId}/favorite`, { method: 'POST' });
  if (!res.ok) throw new Error('No se pudo actualizar el favorito');
  return res.json();
}
