import type { Metadata } from 'next';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { ShareButton } from '@/components/ShareButton';

export const metadata: Metadata = {
  title: 'Analítica de la ciudad',
  description:
    'Panel público de analítica del aparcamiento PMR en Vigo: horas punta, ocupación por zonas, tendencias y plazas más reportadas. Datos agregados y anónimos.',
  alternates: { canonical: '/analytics' },
};

export default function AnalyticsPage() {
  return (
    <div className="container max-w-5xl pb-16 pt-10 sm:pt-14">
      <header className="home-fade-up mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Datos abiertos · Vigo</p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Analítica de la ciudad</h1>
          </div>
          <ShareButton
            label="Compartir"
            title="Analítica PMR de Vigo | MinusVigo"
            text="Mira cómo respira el aparcamiento PMR en Vigo: horas punta, zonas y tendencias en MinusVigo"
          />
        </div>
        <p className="mt-3 max-w-lg text-pretty leading-relaxed text-muted-foreground">
          Cómo respira el aparcamiento PMR en Vigo: agregados anónimos de la actividad de la comunidad durante
          los últimos 30 días.
        </p>
      </header>
      <div className="home-fade-up home-fade-up-delay">
        <AnalyticsDashboard />
      </div>
    </div>
  );
}
