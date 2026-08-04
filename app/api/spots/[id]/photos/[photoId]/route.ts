import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { isModeratorRole } from '@/lib/adminGuard';
import { moderationSchema } from '@/lib/spotContent';
import { deleteSpotPhoto } from '@/lib/supabaseStorage';
import { withPrismaErrors } from '@/lib/apiError';

/**
 * Convención de moderación (documentada en prisma/schema.prisma):
 *  - DELETE: solo el AUTOR. Borrado en firme (bucket + fila de DB).
 *  - PATCH { hidden }: solo MODERATOR/ADMIN. Soft-hide del contenido.
 * Un moderador que quiera borrar en firme no puede: oculta y punto. Así el
 * contenido borrado por error es recuperable y el bucket no acumula basura
 * de moderación.
 */

interface RouteParams {
  params: Promise<{ id: string; photoId: string }>;
}

/** DELETE /api/spots/[id]/photos/[photoId] — solo el autor (hard delete). */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { photoId } = await params;
  const photo = await prisma.spotPhoto.findUnique({ where: { id: photoId } });
  if (!photo) {
    return NextResponse.json({ error: 'Foto no encontrada' }, { status: 404 });
  }
  if (photo.userId !== session.user.id) {
    return NextResponse.json(
      { error: isModeratorRole(session.user.role) ? 'Los moderadores ocultan fotos (PATCH hidden), no las borran' : 'Solo el autor puede borrar esta foto' },
      { status: 403 },
    );
  }

  // Primero el bucket (si falla, no perdemos el storagePath para reintentar)
  // y luego la fila de DB.
  try {
    await deleteSpotPhoto(photo.storagePath);
  } catch (error) {
    console.error('[spot-photos] Error borrando del bucket:', error);
    return NextResponse.json({ error: 'No se pudo borrar la foto. Inténtalo de nuevo.' }, { status: 502 });
  }

  const result = await withPrismaErrors(() => prisma.spotPhoto.delete({ where: { id: photoId } }), 'Foto no encontrada');
  if (result.response) return result.response;

  return NextResponse.json({ ok: true });
}

/** PATCH /api/spots/[id]/photos/[photoId] — MODERATOR/ADMIN: { hidden: boolean }. */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!isModeratorRole(session.user.role)) {
    return NextResponse.json({ error: 'Solo moderadores' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = moderationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const { photoId } = await params;
  const result = await withPrismaErrors(
    () => prisma.spotPhoto.update({ where: { id: photoId }, data: { hidden: parsed.data.hidden } }),
    'Foto no encontrada',
  );
  if (result.response) return result.response;

  return NextResponse.json({ ok: true, hidden: parsed.data.hidden });
}
