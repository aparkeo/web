import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminGuard';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const spots = await prisma.parkingSpot.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { reports: true, favorites: true } } },
    take: 500, // límite de seguridad
  });
  return NextResponse.json(spots);
}

const CreateSpotSchema = z.object({
  id: z.number().int(),
  street: z.string().min(2),
  lat: z.number(),
  lon: z.number(),
  spaces: z.number().int().min(1).default(1),
  city: z.string().default('Vigo'),
});

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = CreateSpotSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const spot = await prisma.parkingSpot.create({ data: parsed.data });
  return NextResponse.json(spot, { status: 201 });
}
