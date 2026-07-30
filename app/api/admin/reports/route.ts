import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminGuard';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const reports = await prisma.report.findMany({
    orderBy: { reportedAt: 'desc' },
    take: 500, // límite de seguridad; usar paginación en UI si se necesita más
    include: {
      spot: { select: { street: true } },
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(reports);
}
