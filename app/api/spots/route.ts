import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { distanceMeters } from '@/lib/utils';
import type { SpotDTO } from '@/types';

const QuerySchema = z.object({
  status: z.enum(['FREE', 'OCCUPIED', 'UNKNOWN']).optional(),
  search: z.string().trim().min(1).optional(),
  lat: z.coerce.number().refine(Number.isFinite).optional(),
  lon: z.coerce.number().refine(Number.isFinite).optional(),
});

// Salvaguarda para no devolver la tabla completa si crece el dataset.
const MAX_SPOTS_PER_QUERY = 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    status: searchParams.get('status') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    lat: searchParams.get('lat') ?? undefined,
    lon: searchParams.get('lon') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros de búsqueda inválidos' }, { status: 400 });
  }
  const { status, search, lat, lon } = parsed.data;

  const session = await auth();

  const spots = await prisma.parkingSpot.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search ? { street: { contains: search, mode: 'insensitive' } } : {}),
    },
    include: session?.user
      ? { favorites: { where: { userId: session.user.id }, select: { id: true } } }
      : undefined,
    orderBy: { street: 'asc' },
    take: MAX_SPOTS_PER_QUERY,
  });

  const dto: SpotDTO[] = spots.map((s) => ({
    id: s.id,
    city: s.city,
    street: s.street,
    lat: s.lat,
    lon: s.lon,
    spaces: s.spaces,
    status: s.status,
    confidence: s.confidence,
    lastReportAt: s.lastReportAt?.toISOString() ?? null,
    distanceM: lat !== undefined && lon !== undefined ? distanceMeters(lat, lon, s.lat, s.lon) : undefined,
    isFavorite: session?.user ? ((s as unknown as { favorites: unknown[] }).favorites?.length ?? 0) > 0 : false,
  }));

  if (lat !== undefined && lon !== undefined) {
    dto.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  }

  return NextResponse.json(dto);
}
