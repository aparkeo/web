import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { getSpotPrediction } from '@/lib/prediction';
import { prisma } from '@/lib/prisma';
import { buildModelFeatures, hasValidModel, scoreWithModel } from '@/lib/predictionModel';
import type { ParkingSpot, Prediction } from '@prisma/client';

// Prisma y el scorer del modelo se mockean a nivel de módulo: estos tests
// no tocan la BD ni el JSON del modelo real.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    report: { groupBy: vi.fn() },
    prediction: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/predictionModel', () => ({
  hasValidModel: vi.fn(() => true),
  scoreWithModel: vi.fn(),
  buildModelFeatures: vi.fn(() => [0, 0, 0, 0, 0, 1, 0.6, 2]),
}));

const groupBy = prisma.report.groupBy as unknown as Mock;
const hasValidModelMock = hasValidModel as unknown as Mock;
const scoreWithModelMock = scoreWithModel as unknown as Mock;
const buildModelFeaturesMock = buildModelFeatures as unknown as Mock;

// Plaza "fría": sin reporte reciente, para aislar la rama histórica.
const staleSpot: ParkingSpot = {
  id: 7,
  city: 'Vigo',
  street: 'Calle Test',
  lat: 42.24,
  lon: -8.72,
  spaces: 1,
  province: null,
  community: null,
  source: null,
  externalId: null,
  status: 'UNKNOWN',
  confidence: 'NONE',
  lastReportAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function historical(freeProbability: number, sampleSize: number): Prediction {
  return {
    id: 'pred-1',
    spotId: 7,
    dayOfWeek: 0,
    hour: 0,
    freeProbability,
    sampleSize,
    confidence: 'LOW',
    updatedAt: new Date(),
  };
}

const PRELOADED_STATS = { freeRate: 0.65, reportCount: 42 };

beforeEach(() => {
  vi.clearAllMocks();
  hasValidModelMock.mockReturnValue(true);
  scoreWithModelMock.mockReturnValue(0.8);
  buildModelFeaturesMock.mockReturnValue([0, 0, 0, 0, 0, 1, 0.6, 2]);
});

describe('getSpotPrediction + modelo GBM (mezcla modelo/bucket)', () => {
  it('mezcla con w = 0.7 cuando hay mucha muestra (sampleSize 50)', async () => {
    // w = min(0.7, 50/50) = 0.7 → 0.8·0.7 + 0.4·0.3 = 0.68
    const result = await getSpotPrediction(staleSpot, historical(0.4, 50), PRELOADED_STATS);
    expect(result.probabilityFree).toBeCloseTo(0.68, 10);
    expect(result.source).toBe('historical');
  });

  it('el peso del modelo escala con la muestra (sampleSize 25 → w = 0.5)', async () => {
    // w = 25/50 = 0.5 → 0.8·0.5 + 0.4·0.5 = 0.6
    const result = await getSpotPrediction(staleSpot, historical(0.4, 25), PRELOADED_STATS);
    expect(result.probabilityFree).toBeCloseTo(0.6, 10);
  });

  it('fallback puro al bucket si el modelo devuelve null', async () => {
    scoreWithModelMock.mockReturnValue(null);
    const result = await getSpotPrediction(staleSpot, historical(0.4, 50), PRELOADED_STATS);
    expect(result.probabilityFree).toBe(0.4);
  });

  it('fallback puro al bucket si no hay modelo válido cargado', async () => {
    hasValidModelMock.mockReturnValue(false);
    const result = await getSpotPrediction(staleSpot, historical(0.4, 50), PRELOADED_STATS);
    expect(result.probabilityFree).toBe(0.4);
    expect(scoreWithModelMock).not.toHaveBeenCalled();
  });

  it('con muestra < 8 el modelo ni se consulta', async () => {
    const result = await getSpotPrediction(staleSpot, historical(0.4, 5), PRELOADED_STATS);
    expect(result.probabilityFree).toBe(0.4);
    expect(scoreWithModelMock).not.toHaveBeenCalled();
  });

  it('con stats precargadas no hace query agregada a la BD', async () => {
    await getSpotPrediction(staleSpot, historical(0.4, 50), PRELOADED_STATS);
    expect(groupBy).not.toHaveBeenCalled();
    expect(buildModelFeaturesMock).toHaveBeenCalledWith(
      expect.objectContaining({ spotFreeRate: 0.65, spotReportsBefore: 42 }),
    );
  });

  it('sin stats precargadas calcula freeRate/reportCount con UN groupBy', async () => {
    groupBy.mockResolvedValueOnce([
      { status: 'FREE', _sum: { weight: 6 }, _count: { _all: 5 } },
      { status: 'OCCUPIED', _sum: { weight: 4 }, _count: { _all: 3 } },
    ]);
    const result = await getSpotPrediction(staleSpot, historical(0.4, 50));
    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(groupBy.mock.calls[0][0]).toMatchObject({
      by: ['status'],
      where: { spotId: 7, status: { not: 'UNKNOWN' } },
    });
    // freeRate = 6/(6+4) = 0.6, reportCount = 5+3 = 8
    expect(buildModelFeaturesMock).toHaveBeenCalledWith(
      expect.objectContaining({ spotFreeRate: 0.6, spotReportsBefore: 8 }),
    );
    expect(result.probabilityFree).toBeCloseTo(0.68, 10);
  });

  it('si la plaza no tiene reportes útiles (stats null) cae al bucket', async () => {
    groupBy.mockResolvedValueOnce([]);
    const result = await getSpotPrediction(staleSpot, historical(0.4, 50));
    expect(result.probabilityFree).toBe(0.4);
    expect(scoreWithModelMock).not.toHaveBeenCalled();
  });

  it('la mezcla live 60/40 se aplica ENCIMA de la mezcla modelo/bucket', async () => {
    const recentWeakSpot: ParkingSpot = {
      ...staleSpot,
      status: 'FREE',
      confidence: 'LOW',
      lastReportAt: new Date(), // reciente pero no CONFIRMED
    };
    // Modelo/bucket: 0.8·0.7 + 0.4·0.3 = 0.68 → live: 1·0.6 + 0.68·0.4 = 0.872
    const result = await getSpotPrediction(recentWeakSpot, historical(0.4, 50), PRELOADED_STATS);
    expect(result.probabilityFree).toBeCloseTo(0.872, 10);
    expect(result.source).toBe('blended');
  });

  it('la señal live CONFIRMED reciente sigue ganando por encima de todo', async () => {
    const liveSpot: ParkingSpot = {
      ...staleSpot,
      status: 'FREE',
      confidence: 'CONFIRMED',
      lastReportAt: new Date(),
    };
    const result = await getSpotPrediction(liveSpot, historical(0.4, 50), PRELOADED_STATS);
    expect(result).toMatchObject({ probabilityFree: 0.95, confidenceLabel: 'Alta', source: 'live' });
    expect(scoreWithModelMock).not.toHaveBeenCalled();
  });
});
