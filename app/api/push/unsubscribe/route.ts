import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// POST /api/push/unsubscribe — elimina la suscripción Web Push del
// dispositivo actual (solo si pertenece al usuario autenticado).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Inicia sesión para gestionar los avisos' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la petición no válido' }, { status: 400 });
  }

  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Endpoint no válido' }, { status: 400 });
  }

  // deleteMany (no delete) para no fallar si ya no existe.
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
