import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Inicia sesión para guardar favoritas' }, { status: 401 });
  }

  const { id } = await params;
  const spotId = Number(id);
  if (!Number.isFinite(spotId)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const existing = await prisma.favorite.findUnique({
    where: { userId_spotId: { userId: session.user.id, spotId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorite: false });
  }

  await prisma.favorite.create({ data: { userId: session.user.id, spotId } });
  return NextResponse.json({ favorite: true });
}
