import Link from 'next/link';
import { Map, BarChart3 } from 'lucide-react';
import { BestSpotCard } from '@/components/BestSpotCard';
import { SITE_URL, SITE_DESCRIPTION } from '@/lib/site';
import { getServerDictionary } from '@/lib/i18n/server';

const secondaryLinkClass =
  'inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-sm transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-secondary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0';

// Datos estructurados para buscadores: la app como WebApplication gratuita.
// El JSON-LD se mantiene en español (inLanguage: es) por simplicidad SEO.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Aparkeo',
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any',
  inLanguage: 'es',
  areaServed: ['Galicia', 'España'],
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
};

export default async function HomePage() {
  const t = await getServerDictionary();
  return (
    <div className="home-hero">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container max-w-2xl pb-16 pt-14 sm:pt-20">
        <header className="home-fade-up mb-10 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {t.home.kicker}
          </p>
          <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
            {t.home.title}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t.home.subtitle}
          </p>
        </header>

        <div className="home-fade-up home-fade-up-delay">
          <BestSpotCard />
        </div>

        <nav aria-label={t.home.exploreAria} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/map" className={secondaryLinkClass}>
            <Map className="h-4 w-4 text-primary" />
            {t.home.viewMap}
          </Link>
          <Link href="/stats" className={secondaryLinkClass}>
            <BarChart3 className="h-4 w-4 text-primary" />
            {t.home.viewStats}
          </Link>
        </nav>
      </div>
    </div>
  );
}
