import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isFreeTransition } from '@/lib/notifications';
import { buildModelFeatures, hasValidModel, scoreWithModel } from '@/lib/predictionModel';
import type { ParkingSpot, Prediction, Confidence, SpotStatus } from '@prisma/client';

/**
 * Módulo de predicción de Aparkeo Web.
 *
 * Tres señales se combinan:
 *  1. "Live" — consenso en tiempo real de los últimos 15 min de Report
 *     (idéntico al algoritmo de consensus.ts de la app móvil: >=2 de peso
 *     y mayoría → CONFIRMED, 1 solo voto → LOW, votos contradictorios →
 *     DISPUTED).
 *  2. "Histórico" — probabilidad agregada de estar libre para esa plaza,
 *     ese día de la semana y esa hora, calculada sobre todo el historial
 *     de Report (tabla Prediction, recalculada por recomputeHistoricalPredictions).
 *  3. "Modelo" — GBM entrenado offline sobre todo el historial de Report
 *     (scripts/train-prediction-model.ts → lib/model/prediction-model.json,
 *     scorer en lib/predictionModel.ts). Solo se mezcla cuando el bucket
 *     histórico tiene muestra suficiente (>=8): p = modelo·w + bucket·(1−w)
 *     con w = min(0.7, sampleSize/50), de modo que el bucket siempre ancla.
 *     Si no hay modelo entrenado (placeholder version 0), no cambia nada.
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

export interface ConsensusVote {
  status: SpotStatus;
  weight: number;
}

export interface ConsensusResult {
  status: SpotStatus;
  confidence: Confidence;
}

/**
 * Consenso "live" puro a partir de los votos recientes (función pura,
 * extraída de recalculateSpotStatus para ser testeable sin BD):
 *  - >=2 de peso y mayoría → CONFIRMED
 *  - votos contradictorios → DISPUTED (gana el lado con más peso; FREE en empate)
 *  - un solo lado con peso >=1 → LOW
 *  - sin votos → UNKNOWN/NONE
 */
export function computeConsensus(votes: ConsensusVote[]): ConsensusResult {
  let freeVotes = 0;
  let occupiedVotes = 0;
  for (const r of votes) {
    if (r.status === 'FREE') freeVotes += r.weight;
    else if (r.status === 'OCCUPIED') occupiedVotes += r.weight;
  }

  if (freeVotes >= 2 && freeVotes > occupiedVotes) {
    return { status: 'FREE', confidence: 'CONFIRMED' };
  }
  if (occupiedVotes >= 2 && occupiedVotes > freeVotes) {
    return { status: 'OCCUPIED', confidence: 'CONFIRMED' };
  }
  if (freeVotes >= 1 && occupiedVotes >= 1) {
    return { status: freeVotes >= occupiedVotes ? 'FREE' : 'OCCUPIED', confidence: 'DISPUTED' };
  }
  if (freeVotes >= 1) {
    return { status: 'FREE', confidence: 'LOW' };
  }
  if (occupiedVotes >= 1) {
    return { status: 'OCCUPIED', confidence: 'LOW' };
  }
  return { status: 'UNKNOWN', confidence: 'NONE' };
}

/**
 * Clasifica los autores de reportes de las últimas 24 h según si coinciden
 * con el estado confirmado (función pura). Devuelve listas de userId
 * deduplicadas para el ajuste de reputación (±puntos con clamp en SQL).
 */
export function classifyReputationReports(
  reports: { userId: string; status: SpotStatus }[],
  status: SpotStatus,
): { agreeing: string[]; contradicting: string[] } {
  const contradicting = [...new Set(reports.filter((r) => r.status !== status).map((r) => r.userId))];
  const agreeing = [...new Set(reports.filter((r) => r.status === status).map((r) => r.userId))];
  return { agreeing, contradicting };
}

/**
 * Resultado del recálculo: si la plaza acaba de transicionar a FREE (desde
 * OCCUPIED/UNKNOWN) el caller puede lanzar el fan-out FAVORITE_FREED. El
 * aviso NO se hace aquí dentro a propósito: va después de la respuesta de la
 * API (vía `after()` en la ruta de reportes) para no alargar el hot path.
 */
export interface SpotStatusChange {
  transitionedToFree: boolean;
  street: string | null;
}

export async function recalculateSpotStatus(spotId: number): Promise<SpotStatusChange> {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);
  const recent = await prisma.report.findMany({
    where: { spotId, reportedAt: { gte: since } },
    orderBy: { reportedAt: 'desc' },
  });

  const { status, confidence } = computeConsensus(recent);

  // Estado previo: necesario para detectar la TRANSICIÓN a FREE (no basta
  // con que el nuevo estado sea FREE — solo se avisa cuando cambia).
  const previous = await prisma.parkingSpot.findUnique({
    where: { id: spotId },
    select: { status: true, street: true },
  });

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

    const { agreeing, contradicting } = classifyReputationReports(reports24h, status);

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

  return {
    transitionedToFree: isFreeTransition(previous?.status, status),
    street: previous?.street ?? null,
  };
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

export function confidenceLabel(score: number): 'Alta' | 'Media' | 'Baja' {
  if (score >= 20) return 'Alta';
  if (score >= 8) return 'Media';
  return 'Baja';
}

/** Estadísticas globales de reportes de una plaza (features del modelo ML). */
export interface SpotModelStats {
  /** Tasa FREE histórica de la plaza ponderada por weight (0-1). */
  freeRate: number;
  /** Nº de reportes con status != UNKNOWN. */
  reportCount: number;
}

// Mínimo de muestra del bucket histórico para mezclar con el modelo, y peso
// máximo del modelo en la mezcla (el bucket siempre ancla al menos un 30%).
const MODEL_MIN_SAMPLE = 8;
const MODEL_MAX_WEIGHT = 0.7;

/**
 * Stats globales de la plaza en UNA query agregada (groupBy por status).
 * `null` si la plaza no tiene reportes útiles todavía.
 */
async function loadSpotModelStats(spotId: number): Promise<SpotModelStats | null> {
  const groups = await prisma.report.groupBy({
    by: ['status'],
    where: { spotId, status: { not: 'UNKNOWN' } },
    _sum: { weight: true },
    _count: { _all: true },
  });
  let freeW = 0;
  let totalW = 0;
  let count = 0;
  for (const g of groups) {
    const w = g._sum.weight ?? 0;
    totalW += w;
    count += g._count._all;
    if (g.status === 'FREE') freeW += w;
  }
  if (count === 0) return null;
  return { freeRate: totalW > 0 ? freeW / totalW : 0.5, reportCount: count };
}

/**
 * Predicción combinada para una plaza, lista para mostrar en PredictionCard.
 *
 * `preloadedHistorical` permite pasar la fila de Prediction ya cargada
 * (p.ej. por best-spot, que la trae en batch para evitar N+1). Si es
 * `undefined` se consulta aquí; si es `null` se asume que no existe.
 *
 * `preloadedSpotStats` (opcional) permite pasar las stats globales de la
 * plaza para el modelo ML en batch (mismo motivo: evitar N+1).
 */
export async function getSpotPrediction(
  spot: ParkingSpot,
  preloadedHistorical?: Prediction | null,
  preloadedSpotStats?: SpotModelStats | null,
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

    // Tercera señal: modelo GBM entrenado offline. Solo se mezcla si el
    // bucket tiene muestra suficiente y hay un modelo válido cargado (el
    // placeholder sin entrenar hace que esto no toque ni la BD).
    if (historical.sampleSize >= MODEL_MIN_SAMPLE && hasValidModel()) {
      const stats =
        preloadedSpotStats !== undefined ? preloadedSpotStats : await loadSpotModelStats(spot.id);
      if (stats) {
        const modelP = scoreWithModel(
          buildModelFeatures({
            dayOfWeek,
            hour,
            weight: 1, // scoring "en frío": no hay reporte concreto, peso neutro
            spotFreeRate: stats.freeRate,
            spotReportsBefore: stats.reportCount,
          }),
        );
        if (modelP !== null) {
          // A más muestra histórica, más peso al modelo (máx. 0.7).
          const w = Math.min(MODEL_MAX_WEIGHT, historical.sampleSize / 50);
          probabilityFree = modelP * w + probabilityFree * (1 - w);
        }
      }
    }

    if (isRecent) {
      const liveSignal = spot.status === 'FREE' ? 1 : spot.status === 'OCCUPIED' ? 0 : 0.5;
      probabilityFree = liveSignal * 0.6 + probabilityFree * 0.4;
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
