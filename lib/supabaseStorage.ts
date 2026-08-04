/**
 * Acceso server-side a Supabase Storage (bucket `spot-photos`).
 *
 * Toda la escritura al bucket pasa exclusivamente por aquí, usando la
 * SUPABASE_SECRET_KEY (service role), que bypassa el RLS de storage.objects.
 * El bucket solo tiene policy de SELECT público (ver
 * scripts/setup-spot-photos-bucket.ts), así que ni la publishable key ni
 * usuarios autenticados de Supabase pueden subir ni borrar objetos: la API
 * route del servidor es la única puerta.
 *
 * La secret key NUNCA se expone al cliente: este módulo solo se importa
 * desde route handlers (servidor) y usa process.env directamente.
 *
 * Se usa la REST API de Storage en lugar de @supabase/supabase-js para no
 * añadir una dependencia nueva solo para dos endpoints (POST/DELETE object).
 */

const BUCKET = 'spot-photos';

function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL');
  return url.replace(/\/$/, '');
}

function secretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Falta SUPABASE_SECRET_KEY');
  return key;
}

/**
 * Sube un objeto al bucket. Devuelve el path relativo dentro del bucket.
 * Lanza si Supabase rechaza la subida (límite de tamaño, mime no permitido,
 * bucket inexistente…).
 */
export async function uploadSpotPhoto(storagePath: string, data: Buffer, contentType: string): Promise<void> {
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      apikey: secretKey(),
      'Content-Type': contentType,
      'x-upsert': 'false',
    },
    body: new Uint8Array(data),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase Storage rechazó la subida (${res.status}): ${detail.slice(0, 200)}`);
  }
}

/** Borra un objeto del bucket. Best-effort: no lanza si ya no existe. */
export async function deleteSpotPhoto(storagePath: string): Promise<void> {
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      apikey: secretKey(),
    },
  });
  // 404/200 ambos aceptables: el objetivo es que el objeto no exista.
  if (!res.ok && res.status !== 404) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase Storage rechazó el borrado (${res.status}): ${detail.slice(0, 200)}`);
  }
}

/** URL pública de un objeto (el bucket es público, policy de SELECT para todos). */
export function spotPhotoPublicUrl(storagePath: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}
