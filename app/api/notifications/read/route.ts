import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

const MarkReadSchema = z
  .object({
    id: z.string().min(1).optional(),
    all: z.boolean().optional(),
  })
  .refine((v) => v.id !== undefined || v.all === true, {
    message: 'Indica una notificación (id) o todas (all)',
  });

// POST /api/notifications/read — marca como leída una notificación del
// usuario (id) o todas las suyas (all: true).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Inicia sesión para gestionar tus notificaciones' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = MarkReadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const userId = session.user.id;

  // updateMany con userId en el where: si la notificación no pertenece al
  // usuario actualiza 0 filas — imposible tocar notificaciones ajenas.
  if (parsed.data.all) {
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true, updated: result.count });
  }

  const result = await prisma.notification.updateMany({
    where: { id: parsed.data.id, userId },
    data: { read: true },
  });
  return NextResponse.json({ ok: true, updated: result.count });
}
