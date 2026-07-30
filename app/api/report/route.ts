import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { recalculateSpotStatus, recomputeHistoricalPredictions } from '@/lib/prediction';

const ReportSchema = z.object({
  spotId: z.number().int(),
  status: z.enum(['FREE', 'OCCUPIED']),
  lat: z.number().optional(),
  lon: z.number().optional(),
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

export async function POST(req: NextRequest) {
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

  const weight = weightFromScore(user.reputationScore);
  if (weight <= 0) {
    return NextResponse.json(
      { error: 'Tu fiabilidad es baja por reportes contradictorios. Espera a que otros confirmen plazas.' },
      { status: 403 },
    );
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

  await prisma.$transaction([
    prisma.report.create({
      data: { spotId, userId: user.id, status, weight, lat, lon, accuracyM },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { reputationScore: { increment: 1 } },
    }),
  ]);

  await recalculateSpotStatus(spotId);
  // Recalcular el histórico es barato a esta escala; en producción se movería
  // a un cron nocturno (ver mejora "Edge Function de limpieza/agregación").
  await recomputeHistoricalPredictions(spotId);

  await prisma.event.create({
    data: { userId: user.id, type: 'spot_report', metadata: { spotId, status } },
  });

  return NextResponse.json({ ok: true, spotId });
}
