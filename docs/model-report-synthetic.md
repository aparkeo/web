# Informe de entrenamiento del modelo de predicción (dataset SINTÉTICO)

Generado por `scripts/train-prediction-model.ts` el 2026-09-01T23:32:25.367Z (modo: synthetic).

## Datos

- Train: 4275 reportes · Test: 1069 reportes (split temporal 80/20, sin aleatoriedad).
- Features: dayOfWeek, hour, isWeekend, hourSin, hourCos, weight, spotFreeRate, spotReportsBeforeLog.
- Hiperparámetros: 80 árboles, profundidad ≤ 3, lr 0.1, minSamplesLeaf 10, subsample 0.8.

## Métricas en test

| Métrica   | Baseline global | Baseline bucket (producción) | Modelo GBM |
| --------- | --------------- | ---------------------------- | ---------- |
| Log-loss  | 0.6831 | 4.5996 | 0.6331 |
| Accuracy  | 57.16% | 55.29% | 65.76% |

**Resultado:** el modelo supera al baseline global Y al baseline por bucket de producción. Modelo escrito en: `lib/model/prediction-model.synthetic.json` (fichero de evaluación; producción sigue con el placeholder).
