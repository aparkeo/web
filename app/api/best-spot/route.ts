import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { distanceMeters } from '@/lib/utils';
import { getSpotPrediction, rankSpotsByRecommendation, vigoNow } from '@/lib/prediction';
import type { Prediction } from '@prisma/client';
import type { SpotWithPrediction } from '@/types';

const SEARCH_RADIUS_M = 2000;
const PAD_DEG = SEARCH_RADIUS_M / 111_000; // ~0.018 grados

// Filtro opcional de estado (búsqueda en lenguaje natural: «plaza libre…»).
const StatusSchema = z.enum(['FREE', 'OCCUPIED']);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'lat/lon requeridos' }, { status: 400 });
  }

  const statusParam = searchParams.get('status');
  const parsedStatus = StatusSchema.safeParse(statusParam ?? undefined);
  if (statusParam !== null && !parsedStatus.success) {
    return NextResponse.json({ error: 'status inválido (FREE | OCCUPIED)' }, { status: 400 });
  }
  const status = parsedStatus.success ? parsedStatus.data : undefined;

  // Filtrado en DB para no cargar ~843 plazas en memoria cada vez.
  const spots = await prisma.parkingSpot.findMany({
    where: {
      lat: { gte: lat - PAD_DEG, lte: lat + PAD_DEG },
      lon: { gte: lon - PAD_DEG, lte: lon + PAD_DEG },
      ...(status ? { status } : {}),
    },
  });

  const withDistance = spots
    .map((s) => ({ spot: s, distanceM: distanceMeters(lat, lon, s.lat, s.lon) }))
    .filter((s) => s.distanceM <= SEARCH_RADIUS_M);

  if (withDistance.length === 0) {
    return NextResponse.json({ spot: null });
  }

  // Una sola query para todas las predicciones históricas del bucket actual
  // (hora local de Vigo), en lugar de un findUnique por plaza (N+1).
  const { dayOfWeek, hour } = vigoNow();
  const historicals = await prisma.prediction.findMany({
    where: { spotId: { in: withDistance.map(({ spot }) => spot.id) }, dayOfWeek, hour },
  });
  const historicalBySpot = new Map<number, Prediction>(historicals.map((p) => [p.spotId, p]));

  const withPrediction = await Promise.all(
    withDistance.map(async ({ spot, distanceM }) => {
      const prediction = await getSpotPrediction(spot, historicalBySpot.get(spot.id) ?? null);
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
