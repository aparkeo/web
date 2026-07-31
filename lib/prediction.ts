import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ParkingSpot, Prediction, Confidence, SpotStatus } from '@prisma/client';

/**
 * Módulo de predicción de MinusVigo Web.
 *
 * Dos señales se combinan:
 *  1. "Live" — consenso en tiempo real de los últimos 15 min de Report
 *     (idéntico al algoritmo de consensus.ts de la app móvil: >=2 de peso
 *     y mayoría → CONFIRMED, 1 solo voto → LOW, votos contradictorios →
 *     DISPUTED).
 *  2. "Histórico" — probabilidad agregada de estar libre para esa plaza,
 *     ese día de la semana y esa hora, calculada sobre todo el historial
 *     de Report (tabla Prediction, recalculada por recomputeHistoricalPredictions).
 *
 * Si hay una señal "live" fuerte (CONFIRMED y reciente) esa gana. Si solo
 * hay una señal débil o no hay ninguna reciente, se usa el histórico —o una
 * mezcla 60/40 (vivo/histórico) cuando hay algo de señal viva pero no
 * suficiente consenso.
 */

export interface SpotPrediction {
  spotId: number;
  probabilityFree: number; // 0-1
  confidenceLabel: 'Alta' | 'Media' | 'Baja';
  source: 'live' | 'historical' | 'blended' | 'none';
  lastUpdated: string | null;
  sampleSize: number;
}

const RECENT_WINDOW_MS = 15 * 60 * 1000;
const REPUTATION_WINDOW_MS = 24 * 60 * 60 * 1000;

// Ciudad cuyo huso horario gobierna los buckets día/hora de las predicciones.
const CITY_TIMEZONE = 'Europe/Madrid';

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const vigoFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CITY_TIMEZONE,
  weekday: 'short',
  hour: 'numeric',
  hourCycle: 'h23',
});

/**
 * Día de la semana (0 = domingo) y hora (0-23) en la zona horaria de Vigo.
 * Sin esto, los buckets de Prediction dependían de la TZ del servidor
 * (UTC en Vercel), desplazando las franjas horarias respecto a la realidad local.
 */
export function vigoNow(date: Date = new Date()): { dayOfWeek: number; hour: number } {
  const parts = vigoFormatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  return { dayOfWeek: WEEKDAY_INDEX[weekday] ?? 0, hour: Number.isFinite(hour) ? hour : 0 };
}

export async function recalculateSpotStatus(spotId: number): Promise<void> {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);
  const recent = await prisma.report.findMany({
    where: { spotId, reportedAt: { gte: since } },
    orderBy: { reportedAt: 'desc' },
  });

  let freeVotes = 0;
  let occupiedVotes = 0;
  for (const r of recent) {
    if (r.status === 'FREE') freeVotes += r.weight;
    else if (r.status === 'OCCUPIED') occupiedVotes += r.weight;
  }

  let status: SpotStatus = 'UNKNOWN';
  let confidence: Confidence = 'NONE';

  if (freeVotes >= 2 && freeVotes > occupiedVotes) {
    status = 'FREE';
    confidence = 'CONFIRMED';
  } else if (occupiedVotes >= 2 && occupiedVotes > freeVotes) {
    status = 'OCCUPIED';
    confidence = 'CONFIRMED';
  } else if (freeVotes >= 1 && occupiedVotes >= 1) {
    status = freeVotes >= occupiedVotes ? 'FREE' : 'OCCUPIED';
    confidence = 'DISPUTED';
  } else if (freeVotes >= 1) {
    status = 'FREE';
    confidence = 'LOW';
  } else if (occupiedVotes >= 1) {
    status = 'OCCUPIED';
    confidence = 'LOW';
  }

  await prisma.parkingSpot.update({
    where: { id: spotId },
    data: { status, confidence, lastReportAt: recent[0]?.reportedAt ?? undefined },
  });

  // Reputación: cuando hay consenso fuerte (CONFIRMED) se compara con los
  // reportes de las últimas 24 h. Los autores que lo contradijeron pierden
  // 5 puntos (mínimo 0); los que acertaron ganan 1 (máximo 100). Se hace con
  // GREATEST/LEAST en SQL para que el clamp sea atómico.
  if (confidence === 'CONFIRMED') {
    const reports24h = await prisma.report.findMany({
      where: { spotId, reportedAt: { gte: new Date(Date.now() - REPUTATION_WINDOW_MS) } },
      select: { userId: true, status: true },
    });

    const contradicting = [...new Set(reports24h.filter((r) => r.status !== status).map((r) => r.userId))];
    const agreeing = [...new Set(reports24h.filter((r) => r.status === status).map((r) => r.userId))];

    const updates: Promise<number>[] = [];
    if (contradicting.length > 0) {
      updates.push(
        prisma.$executeRaw(
          Prisma.sql`UPDATE users SET "reputationScore" = GREATEST(0, "reputationScore" - 5) WHERE id IN (${Prisma.join(contradicting)})`,
        ),
      );
    }
    if (agreeing.length > 0) {
      updates.push(
        prisma.$executeRaw(
          Prisma.sql`UPDATE users SET "reputationScore" = LEAST(100, "reputationScore" + 1) WHERE id IN (${Prisma.join(agreeing)})`,
        ),
      );
    }
    await Promise.all(updates);
  }
}

/** Recalcula la tabla Prediction para una plaza a partir de todo su historial de Report. */
export async function recomputeHistoricalPredictions(spotId: number): Promise<void> {
  const reports = await prisma.report.findMany({ where: { spotId } });
  const buckets = new Map<string, { free: number; total: number }>();

  for (const r of reports) {
    // Buckets en hora local de Vigo, no en la TZ del servidor.
    const { dayOfWeek, hour } = vigoNow(r.reportedAt);
    const key = `${dayOfWeek}-${hour}`;
    const bucket = buckets.get(key) ?? { free: 0, total: 0 };
    bucket.total += r.weight;
    if (r.status === 'FREE') bucket.free += r.weight;
    buckets.set(key, bucket);
  }

  for (const [key, { free, total }] of buckets) {
    const [dayOfWeek, hour] = key.split('-').map(Number);
    const freeProbability = total > 0 ? free / total : 0.5;
    const confidence: Confidence = total >= 20 ? 'CONFIRMED' : total >= 8 ? 'LOW' : 'NONE';

    await prisma.prediction.upsert({
      where: { spotId_dayOfWeek_hour: { spotId, dayOfWeek, hour } },
      update: { freeProbability, sampleSize: total, confidence },
      create: { spotId, dayOfWeek, hour, freeProbability, sampleSize: total, confidence },
    });
  }
}

function confidenceLabel(score: number): 'Alta' | 'Media' | 'Baja' {
  if (score >= 20) return 'Alta';
  if (score >= 8) return 'Media';
  return 'Baja';
}

/**
 * Predicción combinada para una plaza, lista para mostrar en PredictionCard.
 *
 * `preloadedHistorical` permite pasar la fila de Prediction ya cargada
 * (p.ej. por best-spot, que la trae en batch para evitar N+1). Si es
 * `undefined` se consulta aquí; si es `null` se asume que no existe.
 */
export async function getSpotPrediction(
  spot: ParkingSpot,
  preloadedHistorical?: Prediction | null,
): Promise<SpotPrediction> {
  const now = new Date();
  const isRecent = !!spot.lastReportAt && now.getTime() - spot.lastReportAt.getTime() < RECENT_WINDOW_MS;

  if (isRecent && spot.confidence === 'CONFIRMED') {
    return {
      spotId: spot.id,
      probabilityFree: spot.status === 'FREE' ? 0.95 : 0.05,
      confidenceLabel: 'Alta',
      source: 'live',
      lastUpdated: spot.lastReportAt!.toISOString(),
      sampleSize: 0,
    };
  }

  const { dayOfWeek, hour } = vigoNow(now);
  const historical =
    preloadedHistorical !== undefined
      ? preloadedHistorical
      : await prisma.prediction.findUnique({
          where: { spotId_dayOfWeek_hour: { spotId: spot.id, dayOfWeek, hour } },
        });

  if (historical && historical.sampleSize > 0) {
    let probabilityFree = historical.freeProbability;
    if (isRecent) {
      const liveSignal = spot.status === 'FREE' ? 1 : spot.status === 'OCCUPIED' ? 0 : 0.5;
      probabilityFree = liveSignal * 0.6 + historical.freeProbability * 0.4;
    }
    return {
      spotId: spot.id,
      probabilityFree,
      confidenceLabel: confidenceLabel(historical.sampleSize),
      source: isRecent ? 'blended' : 'historical',
      lastUpdated: spot.lastReportAt?.toISOString() ?? null,
      sampleSize: historical.sampleSize,
    };
  }

  if (isRecent) {
    return {
      spotId: spot.id,
      probabilityFree: spot.status === 'FREE' ? 0.8 : spot.status === 'OCCUPIED' ? 0.2 : 0.5,
      confidenceLabel: spot.confidence === 'LOW' ? 'Baja' : 'Media',
      source: 'live',
      lastUpdated: spot.lastReportAt!.toISOString(),
      sampleSize: 0,
    };
  }

  return {
    spotId: spot.id,
    probabilityFree: 0.5,
    confidenceLabel: 'Baja',
    source: 'none',
    lastUpdated: null,
    sampleSize: 0,
  };
}

/** Mejor plaza recomendada entre un conjunto, combinando predicción y distancia. */
export function rankSpotsByRecommendation<
  T extends { distanceM?: number; prediction: SpotPrediction },
>(spots: T[]): T[] {
  return [...spots].sort((a, b) => {
    const scoreA = a.prediction.probabilityFree * 100 - (a.distanceM ?? 5000) / 200;
    const scoreB = b.prediction.probabilityFree * 100 - (b.distanceM ?? 5000) / 200;
    return scoreB - scoreA;
  });
}
