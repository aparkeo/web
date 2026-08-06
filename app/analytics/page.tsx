import type { Metadata } from 'next';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { ShareButton } from '@/components/ShareButton';
import { getServerDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Analítica nacional',
  description:
    'Panel público de analítica del aparcamiento PMR en España: horas punta, ocupación por zonas, tendencias y plazas más reportadas. Datos agregados y anónimos.',
  alternates: { canonical: '/analytics' },
};

export default async function AnalyticsPage() {
  const t = await getServerDictionary();
  return (
    <div className="container max-w-5xl pb-16 pt-10 sm:pt-14">
      <header className="home-fade-up mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t.analytics.kicker}</p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.analytics.title}</h1>
          </div>
          <ShareButton
            label={t.analytics.share}
            title={t.analytics.shareTitle}
            text={t.analytics.shareText}
          />
        </div>
        <p className="mt-3 max-w-lg text-pretty leading-relaxed text-muted-foreground">
          {t.analytics.subtitle}
        </p>
      </header>
      <div className="home-fade-up home-fade-up-delay">
        <AnalyticsDashboard />
      </div>
    </div>
  );
}
