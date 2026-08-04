import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import {
  classifyReputationReports,
  computeConsensus,
  confidenceLabel,
  getSpotPrediction,
  rankSpotsByRecommendation,
  recalculateSpotStatus,
  vigoNow,
  type SpotPrediction,
} from '@/lib/prediction';
import { prisma } from '@/lib/prisma';
import { notifyFavoriteFreed } from '@/lib/notifications';
import type { ParkingSpot } from '@prisma/client';

// Los tests de recalculateSpotStatus NO tocan la base de datos: Prisma y las
// notificaciones están mockeados a nivel de módulo.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    report: { findMany: vi.fn() },
    parkingSpot: { findUnique: vi.fn(), update: vi.fn() },
    prediction: { findUnique: vi.fn(), upsert: vi.fn() },
    $executeRaw: vi.fn(),
  },
}));

vi.mock('@/lib/notifications', () => ({
  notifyFavoriteFreed: vi.fn(),
}));

const reportFindMany = prisma.report.findMany as unknown as Mock;
const spotFindUnique = prisma.parkingSpot.findUnique as unknown as Mock;
const spotUpdate = prisma.parkingSpot.update as unknown as Mock;
const executeRaw = prisma.$executeRaw as unknown as Mock;
const notifyMock = notifyFavoriteFreed as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  spotUpdate.mockResolvedValue({});
  executeRaw.mockResolvedValue(1);
  notifyMock.mockResolvedValue(undefined);
});

describe('computeConsensus (lógica pura de consenso live)', () => {
  it('sin votos → UNKNOWN / NONE', () => {
    expect(computeConsensus([])).toEqual({ status: 'UNKNOWN', confidence: 'NONE' });
  });

  it('un solo voto FREE de peso 1 → FREE / LOW', () => {
    expect(computeConsensus([{ status: 'FREE', weight: 1 }])).toEqual({
      status: 'FREE',
      confidence: 'LOW',
    });
  });

  it('un solo voto OCCUPIED de peso 1 → OCCUPIED / LOW', () => {
    expect(computeConsensus([{ status: 'OCCUPIED', weight: 1 }])).toEqual({
      status: 'OCCUPIED',
      confidence: 'LOW',
    });
  });

  it('peso >= 2 y mayoría FREE → CONFIRMED', () => {
    expect(computeConsensus([{ status: 'FREE', weight: 2 }])).toEqual({
      status: 'FREE',
      confidence: 'CONFIRMED',
    });
    expect(
      computeConsensus([
        { status: 'FREE', weight: 1 },
        { status: 'FREE', weight: 1 },
      ]),
    ).toEqual({ status: 'FREE', confidence: 'CONFIRMED' });
  });

  it('peso >= 2 y mayoría OCCUPIED → CONFIRMED', () => {
    expect(
      computeConsensus([
        { status: 'OCCUPIED', weight: 2 },
        { status: 'FREE', weight: 1 },
      ]),
    ).toEqual({ status: 'OCCUPIED', confidence: 'CONFIRMED' });
  });

  it('votos contradictorios con un lado de peso 2 → CONFIRMED para ese lado', () => {
    expect(
      computeConsensus([
        { status: 'FREE', weight: 1 },
        { status: 'OCCUPIED', weight: 2 },
      ]),
    ).toEqual({ status: 'OCCUPIED', confidence: 'CONFIRMED' });
  });

  it('empate de peso con ambos lados presentes → DISPUTED, desempata a FREE', () => {
    expect(
      computeConsensus([
        { status: 'FREE', weight: 1 },
        { status: 'OCCUPIED', weight: 1 },
      ]),
    ).toEqual({ status: 'FREE', confidence: 'DISPUTED' });
    expect(
      computeConsensus([
        { status: 'FREE', weight: 2 },
        { status: 'OCCUPIED', weight: 2 },
      ]),
    ).toEqual({ status: 'FREE', confidence: 'DISPUTED' });
  });

  it('mayoría de peso 2 aunque el otro lado también tenga votos → CONFIRMED', () => {
    expect(
      computeConsensus([
        { status: 'FREE', weight: 3 },
        { status: 'OCCUPIED', weight: 1 },
      ]),
    ).toEqual({ status: 'FREE', confidence: 'CONFIRMED' });
  });

  it('ignora votos que no son FREE ni OCCUPIED', () => {
    expect(computeConsensus([{ status: 'UNKNOWN', weight: 5 }])).toEqual({
      status: 'UNKNOWN',
      confidence: 'NONE',
    });
  });
});

describe('classifyReputationReports (reputación, lógica pura)', () => {
  it('separa autores que acertaron de los que contradijeron el consenso', () => {
    const { agreeing, contradicting } = classifyReputationReports(
      [
        { userId: 'a', status: 'FREE' },
        { userId: 'b', status: 'OCCUPIED' },
        { userId: 'c', status: 'FREE' },
      ],
      'FREE',
    );
    expect(agreeing).toEqual(['a', 'c']);
    expect(contradicting).toEqual(['b']);
  });

  it('deduplica usuarios con varios reportes en la ventana', () => {
    const { agreeing, contradicting } = classifyReputationReports(
      [
        { userId: 'a', status: 'FREE' },
        { userId: 'a', status: 'FREE' },
        { userId: 'a', status: 'OCCUPIED' },
      ],
      'FREE',
    );
    // El mismo usuario aparece en ambas listas una sola vez (comportamiento actual).
    expect(agreeing).toEqual(['a']);
    expect(contradicting).toEqual(['a']);
  });
});

describe('recalculateSpotStatus (integración con Prisma mockeado)', () => {
  it('actualiza la plaza con el estado del consenso y el último reporte', async () => {
    const reportedAt = new Date('2026-08-04T10:00:00Z');
    reportFindMany.mockResolvedValueOnce([{ status: 'FREE', weight: 2, reportedAt }]);
    spotFindUnique.mockResolvedValueOnce({ status: 'OCCUPIED', street: 'Calle Test' });
    reportFindMany.mockResolvedValueOnce([]); // ventana 24 h (reputación)

    await recalculateSpotStatus(42);

    expect(spotUpdate).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { status: 'FREE', confidence: 'CONFIRMED', lastReportAt: reportedAt },
    });
  });

  it('notifica FAVORITE_FREED solo en la transición a FREE', async () => {
    reportFindMany.mockResolvedValueOnce([{ status: 'FREE', weight: 2, reportedAt: new Date() }]);
    spotFindUnique.mockResolvedValueOnce({ status: 'OCCUPIED', street: 'Calle Test' });
    reportFindMany.mockResolvedValueOnce([]); // ventana 24 h

    await recalculateSpotStatus(7);
    expect(notifyMock).toHaveBeenCalledWith(7, 'Calle Test');
  });

  it('NO notifica si la plaza ya estaba FREE', async () => {
    reportFindMany.mockResolvedValueOnce([{ status: 'FREE', weight: 2, reportedAt: new Date() }]);
    spotFindUnique.mockResolvedValueOnce({ status: 'FREE', street: 'Calle Test' });
    reportFindMany.mockResolvedValueOnce([]);

    await recalculateSpotStatus(7);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('un fallo al notificar no rompe el recálculo', async () => {
    reportFindMany.mockResolvedValueOnce([{ status: 'FREE', weight: 2, reportedAt: new Date() }]);
    spotFindUnique.mockResolvedValueOnce({ status: 'UNKNOWN', street: 'Calle Test' });
    reportFindMany.mockResolvedValueOnce([]);
    notifyMock.mockRejectedValueOnce(new Error('push caído'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(recalculateSpotStatus(7)).resolves.toBeUndefined();
    expect(spotUpdate).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('con consenso CONFIRMED ajusta reputación con clamp SQL (GREATEST/LEAST)', async () => {
    reportFindMany.mockResolvedValueOnce([{ status: 'FREE', weight: 2, reportedAt: new Date() }]);
    spotFindUnique.mockResolvedValueOnce({ status: 'FREE', street: 'Calle Test' });
    reportFindMany.mockResolvedValueOnce([
      { userId: 'acierta', status: 'FREE' },
      { userId: 'contradice', status: 'OCCUPIED' },
    ]);

    await recalculateSpotStatus(9);

    expect(executeRaw).toHaveBeenCalledTimes(2);
    const sqlStatements = executeRaw.mock.calls.map((call) =>
      (call[0] as { strings: readonly string[] }).strings.join('?'),
    );
    // -5 con mínimo 0 para los que contradijeron.
    expect(sqlStatements.some((s) => s.includes('GREATEST(0') && s.includes('- 5'))).toBe(true);
    // +1 con máximo 100 para los que acertaron.
    expect(sqlStatements.some((s) => s.includes('LEAST(100') && s.includes('+ 1'))).toBe(true);
  });

  it('sin consenso CONFIRMED no toca la reputación', async () => {
    reportFindMany.mockResolvedValueOnce([{ status: 'FREE', weight: 1, reportedAt: new Date() }]);
    spotFindUnique.mockResolvedValueOnce({ status: 'UNKNOWN', street: 'Calle Test' });

    await recalculateSpotStatus(9);

    expect(executeRaw).not.toHaveBeenCalled();
    // Solo una consulta de reportes (la ventana de 15 min), no la de 24 h.
    expect(reportFindMany).toHaveBeenCalledTimes(1);
  });
});

describe('vigoNow (buckets en hora local de Vigo)', () => {
  it('convierte UTC a hora local de Madrid en invierno (UTC+1)', () => {
    // Jueves 15 ene 2026 23:30 UTC → viernes 16 ene 00:30 en Vigo.
    expect(vigoNow(new Date('2026-01-15T23:30:00Z'))).toEqual({ dayOfWeek: 5, hour: 0 });
  });

  it('convierte UTC a hora local de Madrid en verano (UTC+2)', () => {
    // Miércoles 15 jul 2026 22:30 UTC → jueves 16 jul 00:30 en Vigo.
    expect(vigoNow(new Date('2026-07-15T22:30:00Z'))).toEqual({ dayOfWeek: 4, hour: 0 });
  });

  it('mediodía UTC es hora punta en Vigo', () => {
    const { dayOfWeek, hour } = vigoNow(new Date('2026-07-15T12:00:00Z'));
    expect(dayOfWeek).toBe(3); // miércoles
    expect(hour).toBe(14);
  });
});

describe('confidenceLabel', () => {
  it('umbrales: >=20 Alta, >=8 Media, resto Baja', () => {
    expect(confidenceLabel(20)).toBe('Alta');
    expect(confidenceLabel(100)).toBe('Alta');
    expect(confidenceLabel(8)).toBe('Media');
    expect(confidenceLabel(19)).toBe('Media');
    expect(confidenceLabel(7)).toBe('Baja');
    expect(confidenceLabel(0)).toBe('Baja');
  });
});

describe('rankSpotsByRecommendation', () => {
  const prediction = (probabilityFree: number): SpotPrediction => ({
    spotId: 1,
    probabilityFree,
    confidenceLabel: 'Media',
    source: 'historical',
    lastUpdated: null,
    sampleSize: 10,
  });

  it('ordena por probabilidad de estar libre menos penalización por distancia', () => {
    const spots = [
      { id: 'lejos-libre', distanceM: 4000, prediction: prediction(0.9) },
      { id: 'cerca-ocupada', distanceM: 100, prediction: prediction(0.1) },
      { id: 'cerca-libre', distanceM: 200, prediction: prediction(0.9) },
    ];
    const ranked = rankSpotsByRecommendation(spots);
    expect(ranked.map((s) => s.id)).toEqual(['cerca-libre', 'lejos-libre', 'cerca-ocupada']);
  });

  it('no muta el array original y usa 5000 m de distancia por defecto', () => {
    const spots = [
      { id: 'sin-distancia', prediction: prediction(0.5) },
      { id: 'con-distancia', distanceM: 0, prediction: prediction(0.5) },
    ];
    const ranked = rankSpotsByRecommendation(spots);
    expect(ranked[0].id).toBe('con-distancia');
    expect(spots[0].id).toBe('sin-distancia');
  });
});

describe('getSpotPrediction (señal live vs histórico)', () => {
  const baseSpot: ParkingSpot = {
    id: 1,
    city: 'Vigo',
    street: 'Calle Test',
    lat: 42.24,
    lon: -8.72,
    spaces: 1,
    status: 'FREE',
    confidence: 'CONFIRMED',
    lastReportAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('señal live CONFIRMED reciente → probabilidad 0.95 y confianza Alta', async () => {
    const result = await getSpotPrediction(baseSpot);
    expect(result).toMatchObject({ probabilityFree: 0.95, confidenceLabel: 'Alta', source: 'live' });
  });

  it('sin histórico ni señal reciente → 0.5, confianza Baja, source none', async () => {
    const staleSpot: ParkingSpot = { ...baseSpot, confidence: 'NONE', lastReportAt: null, status: 'UNKNOWN' };
    const predictionFindUnique = prisma.prediction.findUnique as unknown as Mock;
    predictionFindUnique.mockResolvedValueOnce(null);

    const result = await getSpotPrediction(staleSpot);
    expect(result).toMatchObject({ probabilityFree: 0.5, confidenceLabel: 'Baja', source: 'none' });
  });

  it('histórico precargado + señal reciente débil → mezcla 60/40', async () => {
    const staleSpot: ParkingSpot = {
      ...baseSpot,
      confidence: 'LOW',
      status: 'FREE',
      lastReportAt: new Date(), // reciente pero no CONFIRMED
    };
    const historical = {
      id: 'pred-1',
      spotId: 1,
      dayOfWeek: 0,
      hour: 0,
      freeProbability: 0.25,
      sampleSize: 10,
      confidence: 'LOW' as const,
      updatedAt: new Date(),
    };

    const result = await getSpotPrediction(staleSpot, historical);
    // live=1 (FREE) × 0.6 + 0.25 × 0.4 = 0.7
    expect(result.probabilityFree).toBeCloseTo(0.7, 10);
    expect(result.source).toBe('blended');
    expect(result.sampleSize).toBe(10);
  });
});
