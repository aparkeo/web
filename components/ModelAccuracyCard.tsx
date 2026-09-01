'use client';

import { BrainCircuit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n, useT } from '@/components/i18n/I18nProvider';
import { fmt } from '@/lib/i18n/format';
import type { ModelAnalyticsInfo } from '@/lib/modelAnalytics';

/**
 * Sección «Modelo de predicción» de /analytics: transparencia sobre cómo
 * acierta el GBM que alimenta las predicciones.
 *
 * Tres estados (DTO calculado en servidor por lib/modelAnalytics.ts):
 *  - trained: modelo entrenado con datos reales → grid de métricas.
 *  - validated-synthetic: solo hay validación con datos sintéticos →
 *    métricas con etiqueta visible + progreso hacia el entrenamiento real.
 *  - pending: ni modelo real ni sintético → progreso + texto explicativo.
 */

function MetricTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function pct(proportion: number): string {
  return `${(proportion * 100).toFixed(1)}%`;
}

export function ModelAccuracyCard({ info }: { info: ModelAnalyticsInfo }) {
  const t = useT();
  const { locale } = useI18n();
  const m = t.analytics.model;

  const metrics = info.state === 'trained' ? info.trained : info.synthetic;
  const progressPct = Math.min(100, Math.round((info.realReports / info.minReports) * 100));
  const trainedDate =
    metrics &&
    new Intl.DateTimeFormat(locale === 'gl' ? 'gl-ES' : 'es-ES', { dateStyle: 'long' }).format(
      new Date(metrics.trainedAt),
    );

  return (
    <Card className="rounded-2xl shadow-elevated">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 tracking-tight">
            <BrainCircuit className="h-5 w-5 text-primary" aria-hidden /> {m.title}
          </CardTitle>
          {info.state === 'trained' ? (
            <Badge variant="success">{m.badgeReal}</Badge>
          ) : info.state === 'validated-synthetic' ? (
            <Badge variant="warning">{m.badgeSynthetic}</Badge>
          ) : null}
        </div>
        <CardDescription>{m.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {metrics && trainedDate ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricTile
              label={m.accuracyModel}
              value={pct(metrics.accuracy)}
              hint={fmt(m.vsBaseline, { n: pct(metrics.baselineAccuracy) })}
            />
            <MetricTile
              label={m.logloss}
              value={metrics.logloss.toFixed(3)}
              hint={fmt(m.vsBaseline, { n: metrics.baselineLogloss.toFixed(3) })}
            />
            <MetricTile
              label={fmt(m.trainedAt, { date: trainedDate })}
              value={`${metrics.trainSize} / ${metrics.testSize}`}
              hint={fmt(m.trees, { n: metrics.trees })}
            />
          </div>
        ) : null}

        {/* Progreso hacia el primer entrenamiento real: visible en pending y
            en validación sintética (aún no hay modelo real). */}
        {info.state !== 'trained' ? (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">
                {fmt(m.progressLabel, { n: info.realReports, min: info.minReports })}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{progressPct}%</span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={fmt(m.progressAria, { n: info.realReports, min: info.minReports })}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, progressPct)}%` }} />
            </div>
          </div>
        ) : null}

        {info.state === 'pending' ? (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {m.pendingText}
          </p>
        ) : null}

        {info.state === 'validated-synthetic' ? (
          <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
            {m.syntheticNote}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
