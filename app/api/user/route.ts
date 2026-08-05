import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { deleteSpotPhoto } from '@/lib/supabaseStorage';

/**
 * DELETE /api/user — borrado de cuenta (derecho de supresión, RGPD art. 17).
 *
 * Requiere sesión. Borra TODOS los datos personales del usuario:
 *  - Archivos del bucket `spot-photos` de Supabase Storage PRIMERO (si falla,
 *    no se toca la DB y se puede reintentar: el storagePath sigue disponible).
 *  - Después, en una única transacción, todas las filas ligadas al usuario.
 *    Aunque el schema tiene onDelete: Cascade en la mayoría de relaciones,
 *    el borrado es EXPLÍCITO por dos motivos: `Event.userId` es SetNull (la
 *    cascada desvincularía en vez de borrar, y queremos supresión real) y
 *    porque un deleteMany por colección deja el alcance del borrado
 *    auditable aquí, sin depender de releer el DDL.
 *
 * Salvaguarda: un ADMIN no puede borrar su cuenta si es el ÚNICO admin del
 * sistema (la app se quedaría sin administración). Debe nombrar antes a otro
 * admin desde el panel.
 *
 * Rate limit generoso: 3 borrados/hora por usuario (la operación es
 * destructiva y no debería invocarse en bucle).
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const userId = session.user.id;

  const { success, retryAfterSec } = await rateLimit(`user-delete:${userId}`, 3, 60 * 60_000);
  if (!success) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) {
    // La cuenta ya no existe (doble clic, pestaña duplicada): idempotente.
    return NextResponse.json({ ok: true });
  }

  if (user.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: 'Eres el único administrador. Nombra antes a otro administrador para poder eliminar tu cuenta.' },
        { status: 409 },
      );
    }
  }

  // 1) Bucket primero: si Storage falla, la DB queda intacta y se puede
  //    reintentar sin haber perdido los storagePath.
  const photos = await prisma.spotPhoto.findMany({ where: { userId }, select: { storagePath: true } });
  try {
    for (const photo of photos) {
      await deleteSpotPhoto(photo.storagePath);
    }
  } catch (error) {
    console.error('[user-delete] Error borrando fotos del bucket:', error);
    return NextResponse.json({ error: 'No se pudieron borrar tus fotos. Inténtalo de nuevo.' }, { status: 502 });
  }

  // 2) DB: todo lo ligado al usuario, explícito y en una sola transacción.
  await prisma.$transaction([
    prisma.spotComment.deleteMany({ where: { userId } }),
    prisma.spotPhoto.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.favorite.deleteMany({ where: { userId } }),
    prisma.report.deleteMany({ where: { userId } }),
    prisma.pushSubscription.deleteMany({ where: { userId } }),
    prisma.event.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
