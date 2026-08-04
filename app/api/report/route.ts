import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { recalculateSpotStatus } from '@/lib/prediction';
import { getClientIp, rateLimit } from '@/lib/rateLimit';
import { distanceMeters } from '@/lib/utils';

const ReportSchema = z.object({
  spotId: z.number().int(),
  status: z.enum(['FREE', 'OCCUPIED']),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  accuracyM: z.number().optional(),
});

/** Mismos umbrales que weightFromScore() en la app móvil (deviceReputation.ts). */
function weightFromScore(score: number): number {
  if (score < 40) return 0;
  if (score < 70) return 1;
  if (score < 120) return 2;
  return 3;
}

const COOLDOWN_MS = 60_000;

// Un reporte GPS a más de esta distancia de la plaza no es una observación
// en sitio: vale menos y no se geolocaliza.
const MAX_ONSITE_DISTANCE_M = 150;

export async function POST(req: NextRequest) {
  const { success, retryAfterSec } = await rateLimit(`report:${getClientIp(req)}`, 15, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: 'Demasiadas peticiones. Inténtalo de nuevo en unos segundos.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Inicia sesión para reportar el estado de una plaza' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos de reporte inválidos' }, { status: 400 });
  }

  const { spotId, status, lat, lon, accuracyM } = parsed.data;

  const spot = await prisma.parkingSpot.findUnique({ where: { id: spotId } });
  if (!spot) {
    return NextResponse.json({ error: 'Plaza no encontrada' }, { status: 404 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  let weight = weightFromScore(user.reputationScore);
  if (weight <= 0) {
    return NextResponse.json(
      { error: 'Tu fiabilidad es baja por reportes contradictorios. Espera a que otros confirmen plazas.' },
      { status: 403 },
    );
  }

  // Anti-fraude: si el cliente manda su posición pero está a más de 150 m de
  // la plaza, el reporte se acepta como "a distancia" (no lo rechazamos) pero
  // con peso mínimo y sin geolocalización — no es una observación en sitio.
  let reportLat: number | null | undefined = lat;
  let reportLon: number | null | undefined = lon;
  let reportAccuracyM: number | null | undefined = accuracyM;
  if (lat !== undefined && lon !== undefined) {
    const distance = distanceMeters(lat, lon, spot.lat, spot.lon);
    if (distance > MAX_ONSITE_DISTANCE_M) {
      weight = 1;
      reportLat = null;
      reportLon = null;
      reportAccuracyM = null;
    }
  }

  const recentOwnReport = await prisma.report.findFirst({
    where: {
      spotId,
      userId: user.id,
      reportedAt: { gte: new Date(Date.now() - COOLDOWN_MS) },
    },
  });
  if (recentOwnReport) {
    return NextResponse.json({ error: 'Espera antes de volver a reportar esta plaza.' }, { status: 429 });
  }

  try {
    await prisma.$transaction([
      prisma.report.create({
        data: { spotId, userId: user.id, status, weight, lat: reportLat, lon: reportLon, accuracyM: reportAccuracyM },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { reputationScore: { increment: 1 } },
      }),
    ]);
  } catch (error) {
    // P2002: si existe un constraint único de cooldown (spotId+userId+ventana),
    // la carrera entre dos reportes simultáneos se resuelve aquí como 429.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Espera antes de volver a reportar esta plaza.' }, { status: 429 });
    }
    throw error;
  }

  await recalculateSpotStatus(spotId);
  // El recálculo de predicciones históricas se movió al cron nocturno
  // /api/cron/recompute-predictions para no alargar el hot path del reporte.

  await prisma.event.create({
    data: { userId: user.id, type: 'spot_report', metadata: { spotId, status } },
  });

  return NextResponse.json({ ok: true, spotId });
}
