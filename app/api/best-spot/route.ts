import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { distanceMeters } from '@/lib/utils';
import { getSpotPrediction, rankSpotsByRecommendation } from '@/lib/prediction';
import type { SpotWithPrediction } from '@/types';

const SEARCH_RADIUS_M = 2000;
const PAD_DEG = SEARCH_RADIUS_M / 111_000; // ~0.018 grados

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'lat/lon requeridos' }, { status: 400 });
  }

  // Filtrado en DB para no cargar ~843 plazas en memoria cada vez.
  const spots = await prisma.parkingSpot.findMany({
    where: {
      lat: { gte: lat - PAD_DEG, lte: lat + PAD_DEG },
      lon: { gte: lon - PAD_DEG, lte: lon + PAD_DEG },
    },
  });

  const withDistance = spots
    .map((s) => ({ spot: s, distanceM: distanceMeters(lat, lon, s.lat, s.lon) }))
    .filter((s) => s.distanceM <= SEARCH_RADIUS_M);

  if (withDistance.length === 0) {
    return NextResponse.json({ spot: null });
  }

  const withPrediction = await Promise.all(
    withDistance.map(async ({ spot, distanceM }) => {
      const prediction = await getSpotPrediction(spot);
      const dto: SpotWithPrediction & { distanceM: number } = {
        id: spot.id,
        city: spot.city,
        street: spot.street,
        lat: spot.lat,
        lon: spot.lon,
        spaces: spot.spaces,
        status: spot.status,
        confidence: spot.confidence,
        lastReportAt: spot.lastReportAt?.toISOString() ?? null,
        distanceM,
        prediction,
      };
      return dto;
    }),
  );

  const ranked = rankSpotsByRecommendation(withPrediction);
  return NextResponse.json({ spot: ranked[0] ?? null, alternatives: ranked.slice(1, 4) });
}
