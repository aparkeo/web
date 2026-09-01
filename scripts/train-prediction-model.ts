/**
 * Entrenador offline del modelo de predicción de plazas (Aparkeo).
 *
 * Sustituye (parcialmente) la "media histórica por bucket" por un gradient
 * boosting entrenado sobre todo el historial de Report. El modelo se
 * serializa a lib/model/prediction-model.json y lo consume en runtime
 * lib/predictionModel.ts, que lo mezcla con la media del bucket
 * (lib/prediction.ts).
 *
 * Uso:  npx tsx scripts/train-prediction-model.ts   (o `npm run train:model`)
 *
 * Diseño:
 *  - Dataset: label = 1 si FREE, 0 si OCCUPIED (UNKNOWN excluido).
 *  - Features (orden canónico, duplicado en lib/predictionModel.ts):
 *      dayOfWeek, hour, isWeekend, hourSin, hourCos, weight,
 *      spotFreeRate, spotReportsBeforeLog
 *    `spotFreeRate`/`spotReportsBefore` se calculan SOLO con reportes
 *    anteriores al actual (ventana temporal) para evitar leakage.
 *  - GBM propio (~sin dependencias): boosting con loss logística, árboles
 *    de regresión de profundidad ≤ 3, 80 árboles, lr 0.1, minSamplesLeaf 10,
 *    subsample 0.8. Valores de hoja con paso Newton: Σr / (Σp(1-p) + ε).
 *  - Validación temporal 80/20 (NO aleatoria): si el modelo no supera al
 *    baseline (media global) en log-loss de test, NO se escribe el JSON.
 *
 * Las funciones puras están exportadas para tests unitarios; la parte de BD
 * solo corre en main(), que se ejecuta únicamente si el script se invoca
 * directamente (no al importarlo desde Vitest).
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Features (orden canónico compartido con lib/predictionModel.ts)
// ---------------------------------------------------------------------------

export const FEATURE_NAMES = [
  'dayOfWeek',
  'hour',
  'isWeekend',
  'hourSin',
  'hourCos',
  'weight',
  'spotFreeRate',
  'spotReportsBeforeLog',
] as const;

export interface FeatureInput {
  dayOfWeek: number;
  hour: number;
  weight: number;
  spotFreeRate: number;
  spotReportsBefore: number;
}

/** Misma lógica que buildModelFeatures de lib/predictionModel.ts (duplicada a propósito). */
export function buildFeatures(input: FeatureInput): number[] {
  const { dayOfWeek, hour, weight, spotFreeRate, spotReportsBefore } = input;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
  const angle = (2 * Math.PI * hour) / 24;
  return [
    dayOfWeek,
    hour,
    isWeekend,
    Math.sin(angle),
    Math.cos(angle),
    weight,
    spotFreeRate,
    Math.log1p(Math.max(0, spotReportsBefore)),
  ];
}

// ---------------------------------------------------------------------------
// Buckets día/hora en hora local de Vigo (duplicado de vigoNow en
// lib/prediction.ts para mantener el script independiente de lib/).
// ---------------------------------------------------------------------------

const CITY_TIMEZONE = 'Europe/Madrid';
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};
const vigoFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CITY_TIMEZONE,
  weekday: 'short',
  hour: 'numeric',
  hourCycle: 'h23',
});

export function vigoBucket(date: Date): { dayOfWeek: number; hour: number } {
  const parts = vigoFormatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  return { dayOfWeek: WEEKDAY_INDEX[weekday] ?? 0, hour: Number.isFinite(hour) ? hour : 0 };
}

// ---------------------------------------------------------------------------
// Dataset sin leakage: las stats de la plaza solo miran hacia atrás
// ---------------------------------------------------------------------------

export interface ReportRow {
  spotId: number;
  status: 'FREE' | 'OCCUPIED';
  weight: number;
  reportedAt: Date;
}

export interface DatasetRow {
  features: number[];
  label: number; // 1 = FREE, 0 = OCCUPIED
  reportedAt: Date;
}

/**
 * Construye el dataset ordenado temporalmente. Para cada reporte, la tasa
 * FREE de la plaza y su nº de reportes previos se calculan con los reportes
 * ESTRICTAMENTE anteriores (sin datos futuros → sin leakage).
 */
export function buildDataset(reports: ReportRow[]): DatasetRow[] {
  const sorted = [...reports].sort((a, b) => a.reportedAt.getTime() - b.reportedAt.getTime());
  const perSpot = new Map<number, { freeW: number; totalW: number; count: number }>();
  const rows: DatasetRow[] = [];

  for (const r of sorted) {
    const agg = perSpot.get(r.spotId) ?? { freeW: 0, totalW: 0, count: 0 };
    // Sin historial previo de la plaza → prior neutro 0.5.
    const spotFreeRate = agg.totalW > 0 ? agg.freeW / agg.totalW : 0.5;
    const { dayOfWeek, hour } = vigoBucket(r.reportedAt);

    rows.push({
      features: buildFeatures({
        dayOfWeek,
        hour,
        weight: r.weight,
        spotFreeRate,
        spotReportsBefore: agg.count,
      }),
      label: r.status === 'FREE' ? 1 : 0,
      reportedAt: r.reportedAt,
    });

    agg.totalW += r.weight;
    if (r.status === 'FREE') agg.freeW += r.weight;
    agg.count += 1;
    perSpot.set(r.spotId, agg);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

export function sigmoid(x: number): number {
  if (x >= 0) return 1 / (1 + Math.exp(-x));
  const e = Math.exp(x);
  return e / (1 + e);
}

/** Log-loss binaria con clipping para evitar log(0). */
export function logLoss(labels: number[], probs: number[]): number {
  const eps = 1e-15;
  let sum = 0;
  for (let i = 0; i < labels.length; i++) {
    const p = Math.min(1 - eps, Math.max(eps, probs[i]));
    sum += -(labels[i] * Math.log(p) + (1 - labels[i]) * Math.log(1 - p));
  }
  return labels.length > 0 ? sum / labels.length : 0;
}

export function accuracy(labels: number[], probs: number[]): number {
  if (labels.length === 0) return 0;
  let correct = 0;
  for (let i = 0; i < labels.length; i++) {
    if ((probs[i] >= 0.5 ? 1 : 0) === labels[i]) correct++;
  }
  return correct / labels.length;
}

// ---------------------------------------------------------------------------
// GBM propio (loss logística, árboles de regresión con paso Newton)
// ---------------------------------------------------------------------------

export interface ModelTreeNode {
  v?: number; // hoja: valor (antes de multiplicar por lr)
  f?: number; // nodo interno: índice de feature
  t?: number; // umbral (feature <= t → izquierda)
  l?: ModelTreeNode;
  r?: ModelTreeNode;
}

export interface TrainedModel {
  initScore: number;
  learningRate: number;
  trees: ModelTreeNode[];
}

export const GBM_PARAMS = {
  rounds: 80,
  learningRate: 0.1,
  maxDepth: 3,
  minSamplesLeaf: 10,
  subsample: 0.8,
  maxThresholdsPerFeature: 16,
} as const;

const HESS_EPS = 1e-6;

/** RNG determinista (mulberry32) para que el subsampleo sea reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Recorre un árbol y devuelve el valor de la hoja alcanzada. */
export function evalTreeNode(node: ModelTreeNode, features: number[]): number {
  let cur = node;
  while (cur.v === undefined) {
    const featureValue = features[cur.f ?? 0] ?? 0;
    cur = (featureValue <= (cur.t ?? 0) ? cur.l : cur.r) ?? { v: 0 };
  }
  return cur.v;
}

/**
 * Umbrales candidatos de una feature: cuantiles de sus valores ordenados.
 * Se descarta el máximo (dejaría la rama derecha vacía) y se deduplica.
 */
function candidateThresholds(sortedValues: number[], max: number): number[] {
  const n = sortedValues.length;
  const out = new Set<number>();
  for (let k = 1; k <= max; k++) {
    const idx = Math.min(n - 1, Math.floor((k * n) / (max + 1)));
    out.add(sortedValues[idx]);
  }
  out.delete(sortedValues[n - 1]);
  return [...out].sort((a, b) => a - b);
}

export interface FitTreeOptions {
  maxDepth: number;
  minSamplesLeaf: number;
  maxThresholdsPerFeature: number;
}

/**
 * Ajusta un árbol de regresión a los residuos del gradiente (r = y − p).
 *  - Ganancia de corte al estilo XGBoost: Σ(Σr)²/(Σh+ε) de los hijos menos
 *    la del padre, con h = p(1−p) (hessiana de la loss logística).
 *  - Valor de hoja: paso Newton Σr / (Σh + ε), apropiado para loss logística.
 */
export function fitTree(
  X: number[][],
  residuals: number[],
  hessians: number[],
  opts: FitTreeOptions,
  indices?: number[],
  depth = 0,
): ModelTreeNode {
  const idx = indices ?? X.map((_, i) => i);
  const n = idx.length;
  let sumR = 0;
  let sumH = 0;
  for (const i of idx) {
    sumR += residuals[i];
    sumH += hessians[i];
  }
  const leaf: ModelTreeNode = { v: sumR / (sumH + HESS_EPS) };
  if (depth >= opts.maxDepth || n < 2 * opts.minSamplesLeaf) return leaf;

  const parentScore = (sumR * sumR) / (sumH + HESS_EPS);
  const nFeatures = X[0]?.length ?? 0;
  let best: { f: number; t: number; gain: number } | null = null;

  for (let f = 0; f < nFeatures; f++) {
    const values = idx.map((i) => X[i][f]).sort((a, b) => a - b);
    for (const t of candidateThresholds(values, opts.maxThresholdsPerFeature)) {
      let lR = 0;
      let lH = 0;
      let lN = 0;
      for (const i of idx) {
        if (X[i][f] <= t) {
          lR += residuals[i];
          lH += hessians[i];
          lN++;
        }
      }
      const rN = n - lN;
      if (lN < opts.minSamplesLeaf || rN < opts.minSamplesLeaf) continue;
      const rR = sumR - lR;
      const rH = sumH - lH;
      const gain = (lR * lR) / (lH + HESS_EPS) + (rR * rR) / (rH + HESS_EPS) - parentScore;
      if (gain > 1e-12 && (!best || gain > best.gain)) best = { f, t, gain };
    }
  }
  if (!best) return leaf;

  const leftIdx = idx.filter((i) => X[i][best.f] <= best.t);
  const rightIdx = idx.filter((i) => X[i][best.f] > best.t);
  return {
    f: best.f,
    t: best.t,
    l: fitTree(X, residuals, hessians, opts, leftIdx, depth + 1),
    r: fitTree(X, residuals, hessians, opts, rightIdx, depth + 1),
  };
}

/**
 * Entrena el GBM: F₀ = logit(media de y); en cada ronda, subsample 0.8 sin
 * reemplazo, residuos r = y − sigmoide(F), hessiana h = p(1−p), un árbol y
 * actualización F += lr · árbol(x).
 */
export function fitGbm(
  X: number[][],
  y: number[],
  opts: { rounds: number; learningRate: number; maxDepth: number; minSamplesLeaf: number; subsample: number; maxThresholdsPerFeature: number } = GBM_PARAMS,
): TrainedModel {
  const n = X.length;
  const mean = y.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const clamped = Math.min(1 - 1e-6, Math.max(1e-6, mean));
  const initScore = Math.log(clamped / (1 - clamped));

  const F = new Array<number>(n).fill(initScore);
  const rng = mulberry32(42);
  const trees: ModelTreeNode[] = [];
  const treeOpts = {
    maxDepth: opts.maxDepth,
    minSamplesLeaf: opts.minSamplesLeaf,
    maxThresholdsPerFeature: opts.maxThresholdsPerFeature,
  };
  const sampleSize = Math.min(n, Math.max(2 * opts.minSamplesLeaf, Math.floor(n * opts.subsample)));

  for (let round = 0; round < opts.rounds; round++) {
    // Subsampleo sin reemplazo (estocástico, determinista vía RNG sembrado).
    const order = X.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const sub = order.slice(0, sampleSize);

    const residuals = new Array<number>(n);
    const hessians = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const p = sigmoid(F[i]);
      residuals[i] = y[i] - p;
      hessians[i] = Math.max(p * (1 - p), HESS_EPS);
    }

    const tree = fitTree(X, residuals, hessians, treeOpts, sub);
    trees.push(tree);
    for (let i = 0; i < n; i++) {
      F[i] += opts.learningRate * evalTreeNode(tree, X[i]);
    }
  }
  return { initScore, learningRate: opts.learningRate, trees };
}

/** Logit acumulado: initScore + lr · Σ árboles (mismo cálculo que el scorer). */
export function predictRaw(model: TrainedModel, features: number[]): number {
  let f = model.initScore;
  for (const tree of model.trees) f += model.learningRate * evalTreeNode(tree, features);
  return f;
}

export function predictProba(model: TrainedModel, features: number[]): number {
  return sigmoid(predictRaw(model, features));
}

// ---------------------------------------------------------------------------
// main(): carga BD, entrena, valida y (solo si supera al baseline) escribe
// ---------------------------------------------------------------------------

const MIN_REPORTS_TO_TRAIN = 50;

interface TrainMetrics {
  trainedAt: string;
  trainSize: number;
  testSize: number;
  params: typeof GBM_PARAMS;
  baseline: { logLoss: number; accuracy: number };
  model: { logLoss: number; accuracy: number };
  beatsBaseline: boolean;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const reports = await prisma.report.findMany({
      where: { status: { not: 'UNKNOWN' } },
      orderBy: { reportedAt: 'asc' },
      select: { spotId: true, status: true, weight: true, reportedAt: true },
    });
    console.log(`Reportes cargados (status != UNKNOWN): ${reports.length}`);

    if (reports.length < MIN_REPORTS_TO_TRAIN) {
      console.warn(
        `Insuficientes reportes para entrenar (mínimo ${MIN_REPORTS_TO_TRAIN}). No se escribe ningún modelo; el placeholder sigue activo.`,
      );
      return;
    }

    const rows = buildDataset(
      reports.map((r) => ({
        spotId: r.spotId,
        status: r.status as 'FREE' | 'OCCUPIED',
        weight: r.weight,
        reportedAt: r.reportedAt,
      })),
    );

    // Split temporal 80/20 — NUNCA aleatorio: el test debe ser "el futuro".
    const splitIdx = Math.floor(rows.length * 0.8);
    const train = rows.slice(0, splitIdx);
    const test = rows.slice(splitIdx);
    if (test.length === 0) {
      console.warn('Split temporal dejó el set de test vacío. No se escribe ningún modelo.');
      return;
    }
    console.log(`Split temporal: ${train.length} train / ${test.length} test`);

    const Xtr = train.map((r) => r.features);
    const ytr = train.map((r) => r.label);
    const Xte = test.map((r) => r.features);
    const yte = test.map((r) => r.label);

    // Baseline: media global de train como probabilidad constante.
    const baselineP = ytr.reduce((a, b) => a + b, 0) / ytr.length;

    const model = fitGbm(Xtr, ytr);
    const modelProbs = Xte.map((f) => predictProba(model, f));
    const baselineProbs = Xte.map(() => baselineP);

    const metrics: TrainMetrics = {
      trainedAt: new Date().toISOString(),
      trainSize: train.length,
      testSize: test.length,
      params: GBM_PARAMS,
      baseline: { logLoss: logLoss(yte, baselineProbs), accuracy: accuracy(yte, baselineProbs) },
      model: { logLoss: logLoss(yte, modelProbs), accuracy: accuracy(yte, modelProbs) },
      beatsBaseline: false,
    };
    metrics.beatsBaseline = metrics.model.logLoss < metrics.baseline.logLoss;

    console.log('--- Métricas (JSON) ---');
    console.log(JSON.stringify(metrics, null, 2));
    console.log('------------------------');

    const here = path.dirname(fileURLToPath(import.meta.url));
    const reportPath = path.resolve(here, '..', 'docs', 'model-report.md');
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, renderMarkdownReport(metrics), 'utf8');
    console.log(`Informe escrito en ${reportPath}`);

    if (!metrics.beatsBaseline) {
      console.warn(
        `El modelo NO supera al baseline en test (log-loss ${metrics.model.logLoss.toFixed(4)} vs ${metrics.baseline.logLoss.toFixed(4)}). NO se escribe lib/model/prediction-model.json.`,
      );
      return;
    }

    const modelPath = path.resolve(here, '..', 'lib', 'model', 'prediction-model.json');
    await mkdir(path.dirname(modelPath), { recursive: true });
    await writeFile(
      modelPath,
      JSON.stringify(
        {
          version: 1,
          trainedAt: metrics.trainedAt,
          featureNames: [...FEATURE_NAMES],
          initScore: model.initScore,
          learningRate: model.learningRate,
          trees: model.trees,
          trainMetrics: metrics,
        },
        null,
        2,
      ),
      'utf8',
    );
    console.log(`Modelo escrito en ${modelPath} (${model.trees.length} árboles).`);
  } finally {
    await prisma.$disconnect();
  }
}

function renderMarkdownReport(m: TrainMetrics): string {
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
  return `# Informe de entrenamiento del modelo de predicción

Generado por \`scripts/train-prediction-model.ts\` el ${m.trainedAt}.

## Datos

- Train: ${m.trainSize} reportes · Test: ${m.testSize} reportes (split temporal 80/20, sin aleatoriedad).
- Features: ${FEATURE_NAMES.join(', ')}.
- Hiperparámetros: ${m.params.rounds} árboles, profundidad ≤ ${m.params.maxDepth}, lr ${m.params.learningRate}, minSamplesLeaf ${m.params.minSamplesLeaf}, subsample ${m.params.subsample}.

## Métricas en test

| Métrica   | Baseline (media global) | Modelo GBM |
| --------- | ----------------------- | ---------- |
| Log-loss  | ${m.baseline.logLoss.toFixed(4)} | ${m.model.logLoss.toFixed(4)} |
| Accuracy  | ${pct(m.baseline.accuracy)} | ${pct(m.model.accuracy)} |

**Resultado:** ${m.beatsBaseline ? 'el modelo supera al baseline y se ha escrito `lib/model/prediction-model.json`.' : 'el modelo NO supera al baseline; NO se ha escrito el modelo (sigue el fallback por buckets).'}
`;
}

// Solo ejecutar main() cuando se invoca como script (no al importarlo desde
// Vitest, que solo necesita las funciones puras).
const invokedDirectly =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error('Fallo entrenando el modelo de predicción:', err);
    process.exitCode = 1;
  });
}
