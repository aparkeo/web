import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { isModeratorRole } from '@/lib/adminGuard';
import { moderationSchema } from '@/lib/spotContent';
import { withPrismaErrors } from '@/lib/apiError';

/**
 * Misma convención de moderación que en fotos:
 *  - DELETE: solo el AUTOR (hard delete de la fila).
 *  - PATCH { hidden }: solo MODERATOR/ADMIN (soft-hide).
 */

interface RouteParams {
  params: Promise<{ id: string; commentId: string }>;
}

/** DELETE /api/spots/[id]/comments/[commentId] — solo el autor. */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { commentId } = await params;
  const comment = await prisma.spotComment.findUnique({ where: { id: commentId } });
  if (!comment) {
    return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 });
  }
  if (comment.userId !== session.user.id) {
    return NextResponse.json(
      { error: isModeratorRole(session.user.role) ? 'Los moderadores ocultan comentarios (PATCH hidden), no los borran' : 'Solo el autor puede borrar este comentario' },
      { status: 403 },
    );
  }

  const result = await withPrismaErrors(() => prisma.spotComment.delete({ where: { id: commentId } }), 'Comentario no encontrado');
  if (result.response) return result.response;

  return NextResponse.json({ ok: true });
}

/** PATCH /api/spots/[id]/comments/[commentId] — MODERATOR/ADMIN: { hidden: boolean }. */
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

  const { commentId } = await params;
  const result = await withPrismaErrors(
    () => prisma.spotComment.update({ where: { id: commentId }, data: { hidden: parsed.data.hidden } }),
    'Comentario no encontrado',
  );
  if (result.response) return result.response;

  return NextResponse.json({ ok: true, hidden: parsed.data.hidden });
}
