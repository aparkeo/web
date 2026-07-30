import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { distanceMeters } from '@/lib/utils';
import type { SpotDTO, SpotStatus } from '@/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as SpotStatus | null;
  const search = searchParams.get('search')?.trim() || undefined;
  const lat = searchParams.get('lat') ? Number(searchParams.get('lat')) : undefined;
  const lon = searchParams.get('lon') ? Number(searchParams.get('lon')) : undefined;

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
