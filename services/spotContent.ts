import type { SpotCommentDTO, SpotPhotoDTO } from '@/lib/spotContent';

/**
 * Cliente de las APIs de fotos y comentarios de plazas (roadmap nº9).
 * Los errores de la API vienen como { error: string } en español; se
 * propagan como mensaje del Error para que la UI los muestre tal cual.
 */

async function throwApiError(res: Response, fallback: string): Promise<never> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(data?.error ?? fallback);
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

export async function fetchSpotPhotos(spotId: number): Promise<SpotPhotoDTO[]> {
  const res = await fetch(`/api/spots/${spotId}/photos`);
  if (!res.ok) await throwApiError(res, 'No se pudieron cargar las fotos');
  return res.json();
}

export async function uploadSpotPhoto(spotId: number, file: File): Promise<SpotPhotoDTO> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/spots/${spotId}/photos`, { method: 'POST', body: form });
  if (!res.ok) await throwApiError(res, 'No se pudo subir la foto');
  return res.json();
}

export async function deleteSpotPhoto(spotId: number, photoId: string): Promise<void> {
  const res = await fetch(`/api/spots/${spotId}/photos/${photoId}`, { method: 'DELETE' });
  if (!res.ok) await throwApiError(res, 'No se pudo borrar la foto');
}

export async function setSpotPhotoHidden(spotId: number, photoId: string, hidden: boolean): Promise<void> {
  const res = await fetch(`/api/spots/${spotId}/photos/${photoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hidden }),
  });
  if (!res.ok) await throwApiError(res, 'No se pudo moderar la foto');
}

// ---------------------------------------------------------------------------
// Comentarios
// ---------------------------------------------------------------------------

export async function fetchSpotComments(spotId: number): Promise<SpotCommentDTO[]> {
  const res = await fetch(`/api/spots/${spotId}/comments`);
  if (!res.ok) await throwApiError(res, 'No se pudieron cargar los comentarios');
  return res.json();
}

export async function postSpotComment(spotId: number, body: string): Promise<SpotCommentDTO> {
  const res = await fetch(`/api/spots/${spotId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) await throwApiError(res, 'No se pudo publicar el comentario');
  return res.json();
}

export async function deleteSpotComment(spotId: number, commentId: string): Promise<void> {
  const res = await fetch(`/api/spots/${spotId}/comments/${commentId}`, { method: 'DELETE' });
  if (!res.ok) await throwApiError(res, 'No se pudo borrar el comentario');
}

export async function setSpotCommentHidden(spotId: number, commentId: string, hidden: boolean): Promise<void> {
  const res = await fetch(`/api/spots/${spotId}/comments/${commentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hidden }),
  });
  if (!res.ok) await throwApiError(res, 'No se pudo moderar el comentario');
}
