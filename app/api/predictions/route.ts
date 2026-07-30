import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSpotPrediction } from '@/lib/prediction';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const spotId = Number(searchParams.get('spotId'));
  if (!Number.isFinite(spotId)) {
    return NextResponse.json({ error: 'spotId requerido' }, { status: 400 });
  }

  const spot = await prisma.parkingSpot.findUnique({ where: { id: spotId } });
  if (!spot) {
    return NextResponse.json({ error: 'Plaza no encontrada' }, { status: 404 });
  }

  const prediction = await getSpotPrediction(spot);
  return NextResponse.json(prediction);
}
