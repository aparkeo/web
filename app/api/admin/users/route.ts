import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminGuard';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500, // límite de seguridad
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      reputationScore: true,
      createdAt: true,
      _count: { select: { reports: true, favorites: true } },
    },
  });

  return NextResponse.json(users);
}
