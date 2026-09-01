import modelJson from './model/prediction-model.json';

/**
 * Scorer en runtime del modelo de predicción de Aparkeo (GBM entrenado
 * offline por scripts/train-prediction-model.ts).
 *
 * El modelo vive empaquetado en el bundle como JSON estático
 * (lib/model/prediction-model.json). El placeholder commiteado tiene
 * `version: 0` y `trees: []`, lo que se interpreta como "no hay modelo" —
 * así el build nunca falla aunque nadie haya entrenado todavía, y el
 * fallback a la media del bucket histórico sigue funcionando.
 *
 * IMPORTANTE: la construcción de features está duplicada a propósito en el
 * trainer (scripts/train-prediction-model.ts). No compartir imports entre
 * script y lib para no arrastrar Prisma al bundle de Next.
 */

/** Nodo del árbol serializado: hoja `{ v }` o nodo interno `{ f, t, l, r }`. */
export interface ModelTreeNode {
  /** Valor de la hoja (contribución al logit, ANTES de multiplicar por lr). */
  v?: number;
  /** Índice de la feature de corte (nodo interno). */
  f?: number;
  /** Umbral: feature <= t → hijo izquierdo. */
  t?: number;
  l?: ModelTreeNode;
  r?: ModelTreeNode;
}

export interface PredictionModelJson {
  version: number;
  trainedAt: string | null;
  featureNames: string[];
  /** Logit de la media global del set de entrenamiento (F₀). */
  initScore: number;
  learningRate: number;
  trees: ModelTreeNode[];
  trainMetrics: unknown | null;
}

/**
 * Orden canónico de features (compartido con el trainer):
 *  0 dayOfWeek (0-6, domingo = 0, hora local de Vigo)
 *  1 hour (0-23, hora local de Vigo)
 *  2 isWeekend (0/1)
 *  3 hourSin  — codificación circular de la hora
 *  4 hourCos
 *  5 weight — reputación del reporte (en scoring "en frío" se usa 1, neutro)
 *  6 spotFreeRate — tasa FREE histórica global de la plaza (ponderada)
 *  7 spotReportsBeforeLog — log1p(nº de reportes previos de la plaza)
 */
export const MODEL_FEATURE_NAMES = [
  'dayOfWeek',
  'hour',
  'isWeekend',
  'hourSin',
  'hourCos',
  'weight',
  'spotFreeRate',
  'spotReportsBeforeLog',
] as const;

export interface ModelFeatureInput {
  dayOfWeek: number;
  hour: number;
  weight: number;
  spotFreeRate: number;
  spotReportsBefore: number;
}

const model = modelJson as unknown as PredictionModelJson;

/** Hay un modelo real cargado (el placeholder version 0 / sin árboles no cuenta). */
export function hasValidModel(): boolean {
  return (
    typeof model?.version === 'number' &&
    model.version >= 1 &&
    Array.isArray(model.trees) &&
    model.trees.length > 0 &&
    Number.isFinite(model.initScore)
  );
}

/** Construye el vector de features en el orden canónico (función pura). */
export function buildModelFeatures(input: ModelFeatureInput): number[] {
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

export function sigmoid(x: number): number {
  if (x >= 0) return 1 / (1 + Math.exp(-x));
  const e = Math.exp(x);
  return e / (1 + e);
}

/** Recorre un árbol y devuelve el valor de la hoja alcanzada. */
function evalTreeNode(node: ModelTreeNode, features: number[]): number {
  let cur = node;
  while (cur.v === undefined) {
    const featureValue = features[cur.f ?? 0] ?? 0;
    cur = (featureValue <= (cur.t ?? 0) ? cur.l : cur.r) ?? { v: 0 };
  }
  return cur.v;
}

/**
 * Puntuación de un ensemble dado (función pura, exportada para tests con
 * modelos sintéticos): F = initScore + lr · Σ árbol(x); p = sigmoide(F).
 */
export function scoreTreeEnsemble(m: PredictionModelJson, features: number[]): number {
  let f = m.initScore;
  for (const tree of m.trees) {
    f += m.learningRate * evalTreeNode(tree, features);
  }
  return sigmoid(f);
}

/**
 * Probabilidad de plaza libre según el modelo empaquetado.
 * `null` si no hay modelo válido (placeholder sin entrenar).
 */
export function scoreWithModel(features: number[]): number | null {
  if (!hasValidModel()) return null;
  return scoreTreeEnsemble(model, features);
}
