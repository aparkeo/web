import { describe, expect, it } from 'vitest';
import {
  buildModelFeatures,
  hasValidModel,
  scoreTreeEnsemble,
  scoreWithModel,
  sigmoid,
  type PredictionModelJson,
} from '@/lib/predictionModel';

// El JSON empaquetado en el repo es el placeholder (version 0, sin árboles).
describe('scorer del modelo — placeholder sin entrenar', () => {
  it('hasValidModel() es false con el placeholder commiteado', () => {
    expect(hasValidModel()).toBe(false);
  });

  it('scoreWithModel devuelve null cuando no hay modelo válido', () => {
    const features = buildModelFeatures({
      dayOfWeek: 3,
      hour: 10,
      weight: 1,
      spotFreeRate: 0.6,
      spotReportsBefore: 25,
    });
    expect(scoreWithModel(features)).toBeNull();
  });
});

describe('buildModelFeatures (orden canónico compartido con el trainer)', () => {
  it('construye el vector en el orden canónico', () => {
    const f = buildModelFeatures({
      dayOfWeek: 2,
      hour: 14,
      weight: 3,
      spotFreeRate: 0.75,
      spotReportsBefore: 10,
    });
    expect(f).toHaveLength(8);
    expect(f[0]).toBe(2); // dayOfWeek
    expect(f[1]).toBe(14); // hour
    expect(f[2]).toBe(0); // martes no es fin de semana
    expect(f[3]).toBeCloseTo(Math.sin((2 * Math.PI * 14) / 24), 10); // hourSin
    expect(f[4]).toBeCloseTo(Math.cos((2 * Math.PI * 14) / 24), 10); // hourCos
    expect(f[5]).toBe(3); // weight
    expect(f[6]).toBe(0.75); // spotFreeRate
    expect(f[7]).toBeCloseTo(Math.log1p(10), 10); // spotReportsBeforeLog
  });

  it('isWeekend = 1 solo en domingo (0) y sábado (6)', () => {
    for (const [dow, expected] of [
      [0, 1],
      [6, 1],
      [1, 0],
      [5, 0],
    ] as const) {
      const f = buildModelFeatures({
        dayOfWeek: dow,
        hour: 12,
        weight: 1,
        spotFreeRate: 0.5,
        spotReportsBefore: 0,
      });
      expect(f[2]).toBe(expected);
    }
  });
});

describe('scoreTreeEnsemble (modelo sintético)', () => {
  // Un árbol que corta por spotFreeRate (índice 6) en 0.5:
  // izquierda -2 (probablemente ocupada), derecha +2 (probablemente libre).
  const synthetic: PredictionModelJson = {
    version: 1,
    trainedAt: '2026-08-01T00:00:00.000Z',
    featureNames: [],
    initScore: 0,
    learningRate: 1,
    trees: [{ f: 6, t: 0.5, l: { v: -2 }, r: { v: 2 } }],
    trainMetrics: null,
  };

  const base = { dayOfWeek: 3, hour: 10, weight: 1, spotReportsBefore: 25 };

  it('devuelve probabilidades en (0, 1)', () => {
    const low = scoreTreeEnsemble(synthetic, buildModelFeatures({ ...base, spotFreeRate: 0.2 }));
    const high = scoreTreeEnsemble(synthetic, buildModelFeatures({ ...base, spotFreeRate: 0.9 }));
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThan(1);
    expect(high).toBeGreaterThan(0);
    expect(high).toBeLessThan(1);
  });

  it('es monótona creciente en spotFreeRate', () => {
    const rates = [0.05, 0.2, 0.4, 0.6, 0.8, 0.95];
    const probs = rates.map((r) =>
      scoreTreeEnsemble(synthetic, buildModelFeatures({ ...base, spotFreeRate: r })),
    );
    // El árbol es una función escalón: no decrece nunca…
    for (let i = 1; i < probs.length; i++) {
      expect(probs[i]).toBeGreaterThanOrEqual(probs[i - 1]);
    }
    // …y salta estrictamente al cruzar el umbral 0.5.
    expect(probs[3]).toBeGreaterThan(probs[2]);
    // Con lr=1 e initScore=0: sigmoide(-2) y sigmoide(2).
    expect(probs[0]).toBeCloseTo(sigmoid(-2), 10);
    expect(probs[probs.length - 1]).toBeCloseTo(sigmoid(2), 10);
  });

  it('acumula varios árboles con learning rate', () => {
    const twoTrees: PredictionModelJson = {
      ...synthetic,
      learningRate: 0.5,
      trees: [
        { f: 6, t: 0.5, l: { v: -2 }, r: { v: 2 } },
        { f: 1, t: 12, l: { v: 1 }, r: { v: -1 } }, // hora 10 ≤ 12 → +1
      ],
    };
    // initScore 0 + 0.5·2 + 0.5·1 = 1.5 → sigmoide(1.5)
    const p = scoreTreeEnsemble(twoTrees, buildModelFeatures({ ...base, spotFreeRate: 0.9 }));
    expect(p).toBeCloseTo(sigmoid(1.5), 10);
  });
});
