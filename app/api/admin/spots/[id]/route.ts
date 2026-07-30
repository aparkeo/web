import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminGuard';

const UpdateSpotSchema = z.object({
  street: z.string().min(2).optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  spaces: z.number().int().min(1).optional(),
  status: z.enum(['FREE', 'OCCUPIED', 'UNKNOWN']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const parsed = UpdateSpotSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const spot = await prisma.parkingSpot.update({ where: { id: Number(id) }, data: parsed.data });
  return NextResponse.json(spot);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  await prisma.parkingSpot.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
