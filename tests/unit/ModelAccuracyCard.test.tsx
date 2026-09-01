import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModelAccuracyCard } from '@/components/ModelAccuracyCard';
import type { ModelAnalyticsInfo, ModelMetricsSummary } from '@/lib/modelAnalytics';

// Sin I18nProvider, useT() cae al diccionario español (fallback documentado),
// así que los textos esperados son los de lib/i18n/es.ts.

const METRICS: ModelMetricsSummary = {
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
};

describe('ModelAccuracyCard — estado trained', () => {
  const info: ModelAnalyticsInfo = {
    state: 'trained',
    realReports: 5230,
    minReports: 50,
    trained: METRICS,
  };

  it('muestra badge «Datos reales» y el grid de métricas', () => {
    render(<ModelAccuracyCard info={info} />);
    expect(screen.getByText('Datos reales')).toBeInTheDocument();
    expect(screen.getByText('65.8%')).toBeInTheDocument(); // accuracy del modelo
    expect(screen.getByText('0.633')).toBeInTheDocument(); // log-loss
    expect(screen.getByText('4275 / 1069')).toBeInTheDocument(); // train / test
    expect(screen.getByText(/80 árboles de decisión/)).toBeInTheDocument();
  });

  it('no muestra barra de progreso (ya hay modelo real)', () => {
    render(<ModelAccuracyCard info={info} />);
    expect(screen.queryByText(/reportes para el primer entrenamiento/)).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('ModelAccuracyCard — estado validated-synthetic', () => {
  const info: ModelAnalyticsInfo = {
    state: 'validated-synthetic',
    realReports: 25,
    minReports: 50,
    synthetic: METRICS,
  };

  it('muestra badge «Validación con datos sintéticos», métricas y nota', () => {
    render(<ModelAccuracyCard info={info} />);
    expect(screen.getByText('Validación con datos sintéticos')).toBeInTheDocument();
    expect(screen.getByText('65.8%')).toBeInTheDocument();
    expect(screen.getByText(/estas métricas son orientativas/)).toBeInTheDocument();
  });

  it('muestra la barra de progreso hacia datos reales (25/50 = 50%)', () => {
    render(<ModelAccuracyCard info={info} />);
    expect(screen.getByText('25 de 50 reportes para el primer entrenamiento')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    const bar = screen.getByRole('img', {
      name: 'Progreso hacia el primer entrenamiento: 25 de 50 reportes',
    });
    expect(bar.firstChild).toHaveStyle({ width: '50%' });
  });
});

describe('ModelAccuracyCard — estado pending', () => {
  const info: ModelAnalyticsInfo = { state: 'pending', realReports: 1, minReports: 50 };

  it('muestra progreso y texto explicativo, sin métricas ni badge', () => {
    render(<ModelAccuracyCard info={info} />);
    expect(screen.getByText('1 de 50 reportes para el primer entrenamiento')).toBeInTheDocument();
    expect(screen.getByText('2%')).toBeInTheDocument();
    expect(screen.getByText(/La precisión mejora con cada reporte de la comunidad/)).toBeInTheDocument();
    expect(screen.queryByText('Datos reales')).not.toBeInTheDocument();
    expect(screen.queryByText('Validación con datos sintéticos')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+\.\d%/)).not.toBeInTheDocument(); // sin accuracy
  });

  it('el progreso se satura en 100% aunque haya más reportes del mínimo', () => {
    render(<ModelAccuracyCard info={{ state: 'pending', realReports: 49, minReports: 50 }} />);
    expect(screen.getByText('98%')).toBeInTheDocument();
  });
});
