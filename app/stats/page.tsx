import type { Metadata } from 'next';
import { StatsDashboard } from '@/components/StatsDashboard';
import { getServerDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Estadísticas',
  description: 'Estadísticas en vivo de plazas PMR libres y ocupadas en Vigo.',
};

export default async function StatsPage() {
  const t = await getServerDictionary();
  return (
    <div className="container max-w-5xl pb-16 pt-10 sm:pt-14">
      <header className="home-fade-up mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t.stats.kicker}</p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.stats.title}</h1>
        <p className="mt-3 max-w-lg text-pretty leading-relaxed text-muted-foreground">
          {t.stats.subtitle}
        </p>
      </header>
      <div className="home-fade-up home-fade-up-delay">
        <StatsDashboard />
      </div>
    </div>
  );
}
