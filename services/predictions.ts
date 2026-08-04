import type { PredictionDTO, SpotWithPrediction, UserLocation } from '@/types';

export async function fetchPrediction(spotId: number): Promise<PredictionDTO> {
  const res = await fetch(`/api/predictions?spotId=${spotId}`);
  if (!res.ok) throw new Error('No se pudo cargar la predicción');
  return res.json();
}

export async function fetchBestSpot(
  location: UserLocation,
  status?: 'FREE' | 'OCCUPIED',
): Promise<SpotWithPrediction | null> {
  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
  });
  if (status) params.set('status', status);
  const res = await fetch(`/api/best-spot?${params.toString()}`);
  if (!res.ok) throw new Error('No se pudo calcular la mejor plaza');
  const data = await res.json();
  return data.spot ?? null;
}
