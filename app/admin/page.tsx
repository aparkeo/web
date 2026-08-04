import { StatsDashboard } from '@/components/StatsDashboard';

export default function AdminOverviewPage() {
  return (
    <div>
      <header className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Administración</p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Panel de administración</h1>
        <p className="mt-3 max-w-lg text-pretty leading-relaxed text-muted-foreground">
          Visión general de plazas, reportes y actividad de la comunidad.
        </p>
      </header>
      <StatsDashboard />
    </div>
  );
}
