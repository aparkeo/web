import { prisma } from '@/lib/prisma';
import productionModelJson from './model/prediction-model.json';
import syntheticModelJson from './model/prediction-model.synthetic.json';

/**
 * Analítica del modelo de predicción (GBM) para la sección «Modelo de
 * predicción» de /analytics.
 *
 * Ambos JSON se importan estáticamente (mismo patrón que
 * lib/predictionModel.ts): el placeholder de producción (version 0) y el
 * modelo sintético están commiteados, así el build nunca falla y en
 * serverless no dependemos de fs/output file tracing.
 *
 * Las funciones puras (parseModelMetrics / buildModelAnalyticsInfo) están
 * separadas del IO para ser testeables sin BD.
 */

/** Mínimo de reportes reales (status != UNKNOWN) para el primer entrenamiento. */
export const MIN_REPORTS_FOR_TRAINING = 50;

/** Métricas de un entrenamiento, reducidas a lo que muestra la UI. */
export interface ModelMetricsSummary {
  trainedAt: string;
  logloss: number;
  accuracy: number;
  baselineLogloss: number;
  baselineAccuracy: number;
  bucketLogloss?: number;
  bucketAccuracy?: number;
  trees: number;
  trainSize: number;
  testSize: number;
}

export type ModelAnalyticsState = 'trained' | 'validated-synthetic' | 'pending';

export interface ModelAnalyticsInfo {
  state: ModelAnalyticsState;
  /** Reportes reales útiles (status != UNKNOWN) en la BD. */
  realReports: number;
  minReports: number;
  trained?: ModelMetricsSummary;
  synthetic?: ModelMetricsSummary;
}

interface TrainMetricsJson {
  trainedAt?: unknown;
  trainSize?: unknown;
  testSize?: unknown;
  baseline?: { logLoss?: unknown; accuracy?: unknown };
  bucketBaseline?: { logLoss?: unknown; accuracy?: unknown };
  model?: { logLoss?: unknown; accuracy?: unknown };
}

interface ModelJsonShape {
  version?: unknown;
  trainedAt?: unknown;
  trees?: unknown;
  trainMetrics?: unknown;
}

const isFiniteNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/**
 * Parseo robusto de un prediction-model*.json: devuelve las métricas
 * reducidas o null si falta cualquier campo esencial (version < 1,
 * trainMetrics incompletas, números no finitos...). Nunca lanza.
 */
export function parseModelMetrics(json: unknown): ModelMetricsSummary | null {
  if (typeof json !== 'object' || json === null) return null;
  const root = json as ModelJsonShape;
  if (!isFiniteNumber(root.version) || root.version < 1) return null;
  if (typeof root.trainMetrics !== 'object' || root.trainMetrics === null) return null;

  const tm = root.trainMetrics as TrainMetricsJson;
  const model = tm.model;
  const baseline = tm.baseline;
  if (
    !model ||
    !baseline ||
    !isFiniteNumber(model.logLoss) ||
    !isFiniteNumber(model.accuracy) ||
    !isFiniteNumber(baseline.logLoss) ||
    !isFiniteNumber(baseline.accuracy) ||
    !isFiniteNumber(tm.trainSize) ||
    !isFiniteNumber(tm.testSize)
  ) {
    return null;
  }

  const trainedAt =
    typeof tm.trainedAt === 'string'
      ? tm.trainedAt
      : typeof root.trainedAt === 'string'
        ? root.trainedAt
        : null;
  if (!trainedAt) return null;

  const summary: ModelMetricsSummary = {
    trainedAt,
    logloss: model.logLoss,
    accuracy: model.accuracy,
    baselineLogloss: baseline.logLoss,
    baselineAccuracy: baseline.accuracy,
    trees: Array.isArray(root.trees) ? root.trees.length : 0,
    trainSize: tm.trainSize,
    testSize: tm.testSize,
  };
  if (
    tm.bucketBaseline &&
    isFiniteNumber(tm.bucketBaseline.logLoss) &&
    isFiniteNumber(tm.bucketBaseline.accuracy)
  ) {
    summary.bucketLogloss = tm.bucketBaseline.logLoss;
    summary.bucketAccuracy = tm.bucketBaseline.accuracy;
  }
  return summary;
}

/**
 * Decide el estado del modelo y empaqueta el DTO para la UI (función pura):
 *  - `trained`: el modelo de producción está entrenado con datos reales.
 *  - `validated-synthetic`: no hay modelo real pero sí validación sintética.
 *  - `pending`: ni modelo real ni sintético; solo queda mostrar progreso.
 */
export function buildModelAnalyticsInfo(input: {
  realReports: number;
  productionJson: unknown;
  syntheticJson: unknown | null;
  minReports?: number;
}): ModelAnalyticsInfo {
  const { realReports, productionJson, syntheticJson, minReports = MIN_REPORTS_FOR_TRAINING } = input;
  const trained = parseModelMetrics(productionJson);
  const synthetic = parseModelMetrics(syntheticJson);

  const info: ModelAnalyticsInfo = {
    state: 'pending',
    realReports,
    minReports,
  };
  if (trained) {
    info.state = 'trained';
    info.trained = trained;
    if (synthetic) info.synthetic = synthetic; // contexto histórico de la validación
  } else if (synthetic) {
    info.state = 'validated-synthetic';
    info.synthetic = synthetic;
  }
  return info;
}

/** Dependencias inyectables (para tests sin BD). */
export interface ModelAnalyticsDeps {
  countReports?: () => Promise<number>;
  readSyntheticJson?: () => Promise<unknown | null>;
}

async function defaultReadSyntheticJson(): Promise<unknown | null> {
  // Import estático: el fichero está commiteado, así funciona igual en
  // serverless (sin depender de fs ni de output file tracing).
  return syntheticModelJson as unknown;
}

/** DTO completo para /analytics (servidor): cuenta real + ambos JSON. */
export async function getModelAnalyticsInfo(
  deps: ModelAnalyticsDeps = {},
): Promise<ModelAnalyticsInfo> {
  const countReports =
    deps.countReports ??
    (() => prisma.report.count({ where: { status: { not: 'UNKNOWN' } } }));
  const readSyntheticJson = deps.readSyntheticJson ?? defaultReadSyntheticJson;

  const [realReports, syntheticJson] = await Promise.all([countReports(), readSyntheticJson()]);
  return buildModelAnalyticsInfo({
    realReports,
    productionJson: productionModelJson,
    syntheticJson,
  });
}
