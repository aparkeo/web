import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminGuard';
import { withPrismaErrors } from '@/lib/apiError';

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
  const spotId = Number(id);
  if (!Number.isInteger(spotId)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const parsed = UpdateSpotSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  // P2025 (plaza inexistente) → 404 vía withPrismaErrors.
  const result = await withPrismaErrors(
    () => prisma.parkingSpot.update({ where: { id: spotId }, data: parsed.data }),
    'Plaza no encontrada',
  );
  if (result.response) return result.response;

  return NextResponse.json(result.data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const spotId = Number(id);
  if (!Number.isInteger(spotId)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  // P2025 (plaza inexistente) → 404 vía withPrismaErrors.
  const result = await withPrismaErrors(
    () => prisma.parkingSpot.delete({ where: { id: spotId } }),
    'Plaza no encontrada',
  );
  if (result.response) return result.response;

  return NextResponse.json({ ok: true });
}
