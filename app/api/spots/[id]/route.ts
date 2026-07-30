import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getSpotPrediction } from '@/lib/prediction';
import type { SpotWithPrediction } from '@/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const spotId = Number(id);
  if (!Number.isFinite(spotId)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const session = await auth();

  const spot = await prisma.parkingSpot.findUnique({
    where: { id: spotId },
    include: session?.user
      ? { favorites: { where: { userId: session.user.id }, select: { id: true } } }
      : undefined,
  });

  if (!spot) {
    return NextResponse.json({ error: 'Plaza no encontrada' }, { status: 404 });
  }

  const prediction = await getSpotPrediction(spot);

  const dto: SpotWithPrediction = {
    id: spot.id,
    city: spot.city,
    street: spot.street,
    lat: spot.lat,
    lon: spot.lon,
    spaces: spot.spaces,
    status: spot.status,
    confidence: spot.confidence,
    lastReportAt: spot.lastReportAt?.toISOString() ?? null,
    isFavorite: session?.user ? ((spot as unknown as { favorites: unknown[] }).favorites?.length ?? 0) > 0 : false,
    prediction,
  };

  return NextResponse.json(dto);
}
