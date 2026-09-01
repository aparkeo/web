import { describe, expect, it } from 'vitest';
import {
  accuracy,
  buildDataset,
  buildFeatures,
  evalTreeNode,
  fitGbm,
  fitTree,
  logLoss,
  mulberry32,
  sigmoid,
  vigoBucket,
  type ReportRow,
} from '../../scripts/train-prediction-model';

// Tests de las funciones puras del entrenador: NO tocan la base de datos
// (main() solo corre cuando el script se invoca directamente).

describe('sigmoid / logLoss / accuracy', () => {
  it('sigmoid: 0 → 0.5, monótona, saturada en los extremos', () => {
    expect(sigmoid(0)).toBe(0.5);
    expect(sigmoid(2)).toBeCloseTo(0.8808, 3);
    expect(sigmoid(-2)).toBeCloseTo(0.1192, 3);
    expect(sigmoid(100)).toBeCloseTo(1, 10);
    expect(sigmoid(-100)).toBeCloseTo(0, 10);
  });

  it('logLoss: predicciones perfectas → ~0; constante 0.5 → ln(2)', () => {
    expect(logLoss([1, 0], [0.999999, 0.000001])).toBeLessThan(0.001);
    expect(logLoss([1, 0, 1, 0], [0.5, 0.5, 0.5, 0.5])).toBeCloseTo(Math.LN2, 5);
  });

  it('logLoss nunca devuelve NaN aunque la probabilidad sea 0 o 1', () => {
    expect(Number.isFinite(logLoss([1], [1]))).toBe(true);
    expect(Number.isFinite(logLoss([1], [0]))).toBe(true);
  });

  it('accuracy con umbral 0.5', () => {
    expect(accuracy([1, 0, 1], [0.9, 0.1, 0.4])).toBeCloseTo(2 / 3, 10);
  });
});

describe('buildFeatures (duplicado intencionado de lib/predictionModel)', () => {
  it('codificación circular de la hora y log1p de reportes previos', () => {
    const f = buildFeatures({
      dayOfWeek: 6,
      hour: 6,
      weight: 2,
      spotFreeRate: 0.3,
      spotReportsBefore: 99,
    });
    expect(f).toHaveLength(8);
    expect(f[0]).toBe(6);
    expect(f[1]).toBe(6);
    expect(f[2]).toBe(1); // sábado
    expect(f[3]).toBeCloseTo(1, 10); // sin(2π·6/24) = sin(π/2)
    expect(f[4]).toBeCloseTo(0, 10); // cos(π/2)
    expect(f[5]).toBe(2);
    expect(f[6]).toBe(0.3);
    expect(f[7]).toBeCloseTo(Math.log1p(99), 10);
  });
});

describe('vigoBucket (copia de vigoNow para el script)', () => {
  it('convierte UTC a día/hora local de Madrid', () => {
    // Jueves 15 ene 2026 23:30 UTC → viernes 16 ene 00:30 en Vigo.
    expect(vigoBucket(new Date('2026-01-15T23:30:00Z'))).toEqual({ dayOfWeek: 5, hour: 0 });
  });
});

describe('buildDataset (sin leakage temporal)', () => {
  const r = (
    spotId: number,
    status: 'FREE' | 'OCCUPIED',
    reportedAt: string,
    weight = 1,
  ): ReportRow => ({ spotId, status, weight, reportedAt: new Date(reportedAt) });

  it('la primera vez de una plaza usa prior neutro (0.5) y 0 reportes previos', () => {
    const rows = buildDataset([r(1, 'FREE', '2026-01-05T10:00:00Z')]);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe(1);
    expect(rows[0].features[6]).toBe(0.5); // spotFreeRate
    expect(rows[0].features[7]).toBe(0); // log1p(0)
  });

  it('el segundo reporte solo ve el pasado, nunca el futuro', () => {
    const rows = buildDataset([
      r(1, 'FREE', '2026-01-05T10:00:00Z'),
      r(1, 'OCCUPIED', '2026-01-05T11:00:00Z'),
      r(1, 'FREE', '2026-01-05T12:00:00Z'),
    ]);
    // 2º: solo conoce el 1º (FREE) → freeRate 1, count 1.
    expect(rows[1].label).toBe(0);
    expect(rows[1].features[6]).toBe(1);
    expect(rows[1].features[7]).toBeCloseTo(Math.log1p(1), 10);
    // 3º: conoce FREE+OCCUPIED → freeRate 0.5, count 2.
    expect(rows[2].features[6]).toBe(0.5);
    expect(rows[2].features[7]).toBeCloseTo(Math.log1p(2), 10);
  });

  it('ordena por reportedAt aunque la entrada venga desordenada', () => {
    const rows = buildDataset([
      r(1, 'OCCUPIED', '2026-01-05T12:00:00Z'),
      r(1, 'FREE', '2026-01-05T10:00:00Z'),
    ]);
    expect(rows[0].reportedAt.toISOString()).toBe('2026-01-05T10:00:00.000Z');
    expect(rows[0].label).toBe(1);
  });

  it('pondera spotFreeRate por weight del reporte', () => {
    const rows = buildDataset([
      r(1, 'FREE', '2026-01-05T10:00:00Z', 3),
      r(1, 'OCCUPIED', '2026-01-05T11:00:00Z', 1),
      r(1, 'FREE', '2026-01-05T12:00:00Z'),
    ]);
    // Tras FREE(3) y OCCUPIED(1): freeRate = 3/4.
    expect(rows[2].features[6]).toBeCloseTo(0.75, 10);
  });

  it('las stats de una plaza no contaminan a otra', () => {
    const rows = buildDataset([
      r(1, 'FREE', '2026-01-05T10:00:00Z'),
      r(2, 'FREE', '2026-01-05T10:30:00Z'),
    ]);
    expect(rows[1].features[6]).toBe(0.5); // la plaza 2 no conoce nada aún
  });
});

describe('fitTree (árbol de regresión con paso Newton)', () => {
  it('recupera un corte limpio en un dataset juguete', () => {
    // 40 filas: feature 0 < 5 → residuo +1; >= 5 → residuo −1.
    const X: number[][] = [];
    const residuals: number[] = [];
    const hessians: number[] = [];
    for (let i = 0; i < 40; i++) {
      const x = i < 20 ? 2 : 8;
      X.push([x, 0, 0, 0, 0, 1, 0.5, 1]);
      residuals.push(i < 20 ? 1 : -1);
      hessians.push(0.25);
    }
    const tree = fitTree(X, residuals, hessians, {
      maxDepth: 3,
      minSamplesLeaf: 10,
      maxThresholdsPerFeature: 16,
    });
    expect(tree.f).toBe(0);
    expect(tree.t).toBeGreaterThanOrEqual(2);
    expect(tree.t).toBeLessThan(8);
    // Hojas con paso Newton: ±1 / 0.25 = ±4.
    expect(evalTreeNode(tree, X[0])).toBeCloseTo(4, 5);
    expect(evalTreeNode(tree, X[39])).toBeCloseTo(-4, 5);
  });

  it('respeta minSamplesLeaf (sin corte posible → hoja)', () => {
    const X = Array.from({ length: 10 }, (_, i) => [i, 0, 0, 0, 0, 1, 0.5, 1]);
    const residuals = X.map((_, i) => (i < 5 ? 1 : -1));
    const hessians = X.map(() => 0.25);
    const tree = fitTree(X, residuals, hessians, {
      maxDepth: 3,
      minSamplesLeaf: 6, // imposible partir 10 en dos hijos de ≥6
      maxThresholdsPerFeature: 16,
    });
    expect(tree.v).toBeDefined();
  });
});

describe('fitGbm (boosting con loss logística)', () => {
  it('aprende un dataset separable y supera al baseline', () => {
    // 200 filas: spotFreeRate (índice 6) determina la etiqueta.
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 200; i++) {
      const free = i % 2 === 0;
      X.push(
        buildFeatures({
          dayOfWeek: 2,
          hour: 10,
          weight: 1,
          spotFreeRate: free ? 0.85 : 0.15,
          spotReportsBefore: 20,
        }),
      );
      y.push(free ? 1 : 0);
    }
    const model = fitGbm(X, y);
    expect(model.trees.length).toBeGreaterThan(0);

    const probs = X.map((f) => {
      let s = model.initScore;
      for (const t of model.trees) s += model.learningRate * evalTreeNode(t, f);
      return sigmoid(s);
    });
    const baseline = y.reduce((a, b) => a + b, 0) / y.length;
    const baselineProbs = y.map(() => baseline);

    expect(logLoss(y, probs)).toBeLessThan(logLoss(y, baselineProbs));
    expect(accuracy(y, probs)).toBe(1);
  });

  it('el subsampleo es determinista (misma semilla → mismo modelo)', () => {
    const X = Array.from({ length: 60 }, (_, i) =>
      buildFeatures({
        dayOfWeek: i % 7,
        hour: i % 24,
        weight: 1,
        spotFreeRate: (i % 10) / 10,
        spotReportsBefore: i,
      }),
    );
    const y = X.map((_, i) => (i % 3 === 0 ? 1 : 0));
    const a = fitGbm(X, y);
    const b = fitGbm(X, y);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('mulberry32 es determinista y devuelve valores en [0, 1)', () => {
    const rngA = mulberry32(42);
    const rngB = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = rngA();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(v).toBe(rngB());
    }
  });
});
