// Paleta semántica del panel de analítica, compartida entre el dashboard
// (barras HTML) y los gráficos recharts (cargados de forma diferida).
// Misma escala que StatusPieChart; legible en claro y oscuro.
export const ANALYTICS_COLORS = {
  free: '#16A34A',
  occupied: '#DC2626',
  muted: '#94A3B8',
} as const;
