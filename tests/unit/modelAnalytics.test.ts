import { describe, expect, it, vi } from 'vitest';
import {
  buildModelAnalyticsInfo,
  getModelAnalyticsInfo,
  MIN_REPORTS_FOR_TRAINING,
  parseModelMetrics,
} from '@/lib/modelAnalytics';

// Prisma mockeado a nivel de módulo: estos tests no tocan la BD.
vi.mock('@/lib/prisma', () => ({
  prisma: { report: { count: vi.fn(async () => 1) } },
}));

const VALID_METRICS_JSON = {
  version: 1,
  trainedAt: '2026-09-01T23:32:25.367Z',
  trees: Array.from({ length: 80 }, () => ({ v: 0.1 })),
  trainMetrics: {
    trainedAt: '2026-09-01T23:32:25.367Z',
    trainSize: 4275,
    testSize: 1069,
    baseline: { logLoss: 0.6831, accuracy: 0.5716 },
    bucketBaseline: { logLoss: 4.5996, accuracy: 0.5529 },
    model: { logLoss: 0.6331, accuracy: 0.6576 },
  },
};

describe('parseModelMetrics (parseo robusto del JSON de modelo)', () => {
  it('parsea un modelo válido completo (con baseline por bucket)', () => {
    const m = parseModelMetrics(VALID_METRICS_JSON);
    expect(m).toEqual({
      trainedAt: '2026-09-01T23:32:25.367Z',
      logloss: 0.6331,
      accuracy: 0.6576,
      baselineLogloss: 0.6831,
      baselineAccuracy: 0.5716,
      bucketLogloss: 4.5996,
      bucketAccuracy: 0.5529,
      trees: 80,
      trainSize: 4275,
      testSize: 1069,
    });
  });

  it('sin bucketBaseline devuelve métricas sin esos campos', () => {
    const json = structuredClone(VALID_METRICS_JSON);
    delete (json.trainMetrics as Record<string, unknown>).bucketBaseline;
    const m = parseModelMetrics(json);
    expect(m).not.toBeNull();
    expect(m).not.toHaveProperty('bucketLogloss');
    expect(m).not.toHaveProperty('bucketAccuracy');
  });

  it('placeholder version 0 → null (no hay modelo)', () => {
    expect(parseModelMetrics({ version: 0, trainedAt: null, trees: [], trainMetrics: null })).toBeNull();
  });

  it('trainMetrics incompletas → null (no lanza)', () => {
    const casos: unknown[] = [
      { version: 1, trees: [{ v: 1 }], trainMetrics: { model: { logLoss: 0.5 } } }, // falta accuracy y baseline
      { version: 1, trees: [{ v: 1 }], trainMetrics: null },
      { version: 1, trees: [{ v: 1 }] }, // sin trainMetrics
      { version: 1, trees: [{ v: 1 }], trainMetrics: { trainedAt: '2026-01-01', trainSize: 100, testSize: 20, baseline: { logLoss: 0.7, accuracy: 0.5 }, model: { logLoss: Number.NaN, accuracy: 0.6 } } }, // no finito
      null,
      'no es un modelo',
      42,
    ];
    for (const c of casos) {
      expect(parseModelMetrics(c)).toBeNull();
    }
  });

  it('trainedAt cae al del root si trainMetrics no lo trae', () => {
    const json = structuredClone(VALID_METRICS_JSON);
    delete (json.trainMetrics as Record<string, unknown>).trainedAt;
    const m = parseModelMetrics(json);
    expect(m?.trainedAt).toBe('2026-09-01T23:32:25.367Z');
  });
});

describe('buildModelAnalyticsInfo (máquina de estados)', () => {
  it('modelo real entrenado → trained (aunque también haya sintético)', () => {
    const info = buildModelAnalyticsInfo({
      realReports: 5000,
      productionJson: VALID_METRICS_JSON,
      syntheticJson: VALID_METRICS_JSON,
    });
    expect(info.state).toBe('trained');
    expect(info.trained?.trees).toBe(80);
    expect(info.synthetic).toBeDefined(); // contexto histórico
  });

  it('sin modelo real pero con sintético → validated-synthetic', () => {
    const info = buildModelAnalyticsInfo({
      realReports: 1,
      productionJson: { version: 0, trees: [], trainMetrics: null },
      syntheticJson: VALID_METRICS_JSON,
    });
    expect(info.state).toBe('validated-synthetic');
    expect(info.trained).toBeUndefined();
    expect(info.synthetic?.logloss).toBe(0.6331);
  });

  it('ni modelo real ni sintético → pending', () => {
    const info = buildModelAnalyticsInfo({
      realReports: 7,
      productionJson: { version: 0, trees: [], trainMetrics: null },
      syntheticJson: null,
    });
    expect(info.state).toBe('pending');
    expect(info.realReports).toBe(7);
    expect(info.minReports).toBe(MIN_REPORTS_FOR_TRAINING);
  });

  it('minReports es configurable y por defecto 50', () => {
    const info = buildModelAnalyticsInfo({
      realReports: 0,
      productionJson: null,
      syntheticJson: null,
      minReports: 10,
    });
    expect(info.minReports).toBe(10);
  });
});

describe('getModelAnalyticsInfo (deps inyectables)', () => {
  it('fallback si falta el JSON sintético (readSyntheticJson → null)', async () => {
    const info = await getModelAnalyticsInfo({
      countReports: async () => 23,
      readSyntheticJson: async () => null,
    });
    // El JSON de producción del repo es el placeholder → pending.
    expect(info).toMatchObject({ state: 'pending', realReports: 23, minReports: 50 });
  });

  it('con sintético disponible → validated-synthetic con el conteo real', async () => {
    const info = await getModelAnalyticsInfo({
      countReports: async () => 12,
      readSyntheticJson: async () => VALID_METRICS_JSON,
    });
    expect(info.state).toBe('validated-synthetic');
    expect(info.realReports).toBe(12);
    expect(info.synthetic?.trainSize).toBe(4275);
  });
});
