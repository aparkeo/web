import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import {
  PHOTO_ALLOWED_MIME,
  PHOTO_EXTENSION,
  PHOTO_MAX_BYTES,
  PHOTOS_RATE_LIMIT,
  isAllowedPhotoMime,
  type SpotPhotoDTO,
} from '@/lib/spotContent';
import { spotPhotoPublicUrl, uploadSpotPhoto, deleteSpotPhoto } from '@/lib/supabaseStorage';

function parseSpotId(id: string): number | null {
  const spotId = Number(id);
  return Number.isFinite(spotId) ? spotId : null;
}

/** GET /api/spots/[id]/photos — fotos visibles (hidden=false), más recientes primero. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const spotId = parseSpotId(id);
  if (spotId === null) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const photos = await prisma.spotPhoto.findMany({
    where: { spotId, hidden: false },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { name: true } } },
  });

  const dto: SpotPhotoDTO[] = photos.map((p) => ({
    id: p.id,
    url: p.url,
    authorId: p.userId,
    authorName: p.user.name ?? 'Usuario',
    createdAt: p.createdAt.toISOString(),
  }));

  return NextResponse.json(dto);
}

/**
 * POST /api/spots/[id]/photos — sube una foto de la plaza.
 *
 * Solo server-side: el archivo se sube a Supabase Storage con la service
 * role key desde aquí (el bucket no tiene policies de escritura para
 * anon/authenticated). Validaciones: sesión, rate limit 5/hora por usuario,
 * mime jpeg/png/webp, tamaño ≤ 5 MB.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Inicia sesión para subir fotos' }, { status: 401 });
  }

  const { id } = await params;
  const spotId = parseSpotId(id);
  if (spotId === null) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const { success, retryAfterSec } = await rateLimit(
    `spot-photos:${session.user.id}`,
    PHOTOS_RATE_LIMIT.limit,
    PHOTOS_RATE_LIMIT.windowMs,
  );
  if (!success) {
    return NextResponse.json(
      { error: 'Has subido demasiadas fotos. Inténtalo de nuevo más tarde.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  const spot = await prisma.parkingSpot.findUnique({ where: { id: spotId }, select: { id: true } });
  if (!spot) {
    return NextResponse.json({ error: 'Plaza no encontrada' }, { status: 404 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const entry = form.get('file');
    if (entry instanceof File) file = entry;
  } catch {
    return NextResponse.json({ error: 'Cuerpo de petición inválido (se esperaba multipart/form-data)' }, { status: 400 });
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
  }
  if (!isAllowedPhotoMime(file.type)) {
    return NextResponse.json(
      { error: `Formato no permitido. Usa ${PHOTO_ALLOWED_MIME.join(', ')}` },
      { status: 400 },
    );
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: 'La foto supera el máximo de 5 MB' }, { status: 400 });
  }

  const ext = PHOTO_EXTENSION[file.type];
  const storagePath = `${spotId}/${session.user.id}/${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await uploadSpotPhoto(storagePath, buffer, file.type);
  } catch (error) {
    console.error('[spot-photos] Error subiendo a Supabase Storage:', error);
    return NextResponse.json({ error: 'No se pudo subir la foto. Inténtalo de nuevo.' }, { status: 502 });
  }

  const url = spotPhotoPublicUrl(storagePath);
  try {
    const photo = await prisma.spotPhoto.create({
      data: { spotId, userId: session.user.id, url, storagePath },
      include: { user: { select: { name: true } } },
    });

    const dto: SpotPhotoDTO = {
      id: photo.id,
      url: photo.url,
      authorId: photo.userId,
      authorName: photo.user.name ?? 'Usuario',
      createdAt: photo.createdAt.toISOString(),
    };
    return NextResponse.json(dto, { status: 201 });
  } catch (error) {
    // Consistencia: si falla la fila de DB, intentamos no dejar el objeto
    // huérfano en el bucket (best-effort).
    await deleteSpotPhoto(storagePath).catch(() => undefined);
    throw error;
  }
}
