import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { recalculateSpotStatus } from '@/lib/prediction';
import { notifyFavoriteFreed } from '@/lib/notifications';
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

const COOLDOWN_RESPONSE = { error: 'Espera antes de volver a reportar esta plaza.' };

/**
 * ¿Es una violación del cooldown de reportes? Cubre dos casos:
 *  - P2002: constraint única (compatibilidad con la mitigación anterior).
 *  - SQLSTATE 23P01: violation de la exclusion constraint
 *    `reports_cooldown_excl` (la garantía real a nivel de DB, roadmap nº10).
 *    Prisma no la mapea a P2002 (eso es solo para únicas): llega como error
 *    raw, así que se detecta por el código 23P01 o el nombre de la constraint.
 */
function isReportCooldownViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return true;
  }
  const e = error as { code?: string; meta?: { code?: string }; message?: string } | null;
  if (e?.code === '23P01' || e?.meta?.code === '23P01') return true;
  const message = e?.message ?? String(error);
  return message.includes('23P01') || message.includes('reports_cooldown_excl');
}

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
    return NextResponse.json(COOLDOWN_RESPONSE, { status: 429 });
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
    // La comprobación de arriba es solo un fast-path de UX: la exclusion
    // constraint `reports_cooldown_excl` es la que garantiza el cooldown
    // incluso con escrituras concurrentes (race condition) o externas a la
    // API. Su violación (23P01) se responde exactamente igual que el
    // fast-path: 429 con el mismo mensaje, nunca un 500.
    if (isReportCooldownViolation(error)) {
      return NextResponse.json(COOLDOWN_RESPONSE, { status: 429 });
    }
    throw error;
  }

  const statusChange = await recalculateSpotStatus(spotId);
  // El recálculo de predicciones históricas se movió al cron nocturno
  // /api/cron/recompute-predictions para no alargar el hot path del reporte.

  // Fan-out FAVORITE_FREED: solo en transición real hacia FREE. Se programa
  // con `after()` (Next 15 — en Vercel usa waitUntil bajo el capó), así la
  // respuesta no espera a las notificaciones pero el trabajo NO se corta al
  // congelarse la función serverless, como pasaría con un fire-and-forget.
  // Se excluye al autor del reporte: no tiene sentido avisarle de lo que
  // acaba de reportar él mismo.
  if (statusChange.transitionedToFree && statusChange.street) {
    const street = statusChange.street;
    after(async () => {
      try {
        await notifyFavoriteFreed(spotId, street, { excludeUserId: user.id });
      } catch (error) {
        console.error('Error creando notificaciones FAVORITE_FREED', error);
      }
    });
  }

  await prisma.event.create({
    data: { userId: user.id, type: 'spot_report', metadata: { spotId, status } },
  });

  return NextResponse.json({ ok: true, spotId });
}
