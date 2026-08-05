import type { Metadata } from 'next';
import { Coffee, HandCoins, Heart, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SponsorsSection } from '@/components/SponsorsSection';
import { SPONSORS, SUPPORT_KOFI_URL, SUPPORT_PAYPAL_URL } from '@/lib/support';
import { getServerDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Apoya el proyecto',
  description:
    'Aparkeo es un proyecto comunitario y gratuito. Las donaciones y el patrocinio local cubren el servidor, la base de datos, el dominio y el tiempo de desarrollo. El mapa y los reportes serán siempre gratuitos.',
  alternates: { canonical: '/apoyo' },
};

const donationButtonClass =
  'btn-cta inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export default async function ApoyoPage() {
  const t = await getServerDictionary();

  return (
    <div className="container max-w-3xl space-y-6 pb-16 pt-10 sm:pt-14">
      <header className="home-fade-up space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          {t.apoyo.kicker}
        </p>
        <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t.apoyo.title}
        </h1>
        <p className="mx-auto max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t.apoyo.intro}
        </p>
      </header>

      <Card className="home-fade-up home-fade-up-delay rounded-2xl shadow-elevated">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t.apoyo.transparencyKicker}</p>
          <CardTitle className="flex items-center gap-2 tracking-tight">
            <Server className="h-5 w-5 text-primary" aria-hidden="true" />
            {t.apoyo.transparencyTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>{t.apoyo.transparencyBody}</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">{t.apoyo.transparencyServer}</strong>{' '}
              {t.apoyo.transparencyServerBody}
            </li>
            <li>
              <strong className="text-foreground">{t.apoyo.transparencyDomain}</strong>{' '}
              {t.apoyo.transparencyDomainBody}
            </li>
            <li>
              <strong className="text-foreground">{t.apoyo.transparencyTime}</strong>
              {t.apoyo.transparencyTimeBody}
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="home-fade-up home-fade-up-delay grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl border-border/60 bg-card/90 bg-gradient-to-b from-accent/15 via-transparent to-transparent shadow-elevated backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
              <Coffee className="h-5 w-5 text-primary" aria-hidden="true" />
              {t.apoyo.kofiTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{t.apoyo.kofiBody}</p>
            <a
              href={SUPPORT_KOFI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={donationButtonClass}
            >
              <Coffee className="h-4 w-4" aria-hidden="true" />
              {t.apoyo.kofiButton}
            </a>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 bg-card/90 bg-gradient-to-b from-accent/15 via-transparent to-transparent shadow-elevated backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
              <HandCoins className="h-5 w-5 text-primary" aria-hidden="true" />
              {t.apoyo.paypalTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{t.apoyo.paypalBody}</p>
            <a
              href={SUPPORT_PAYPAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={donationButtonClass}
            >
              <HandCoins className="h-4 w-4" aria-hidden="true" />
              {t.apoyo.paypalButton}
            </a>
          </CardContent>
        </Card>
      </div>

      <SponsorsSection sponsors={SPONSORS} labels={t.apoyo} />

      <p className="home-fade-up home-fade-up-delay-2 flex items-start justify-center gap-2 text-center text-sm leading-relaxed text-muted-foreground">
        <Heart className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{t.apoyo.closingNote}</span>
      </p>
    </div>
  );
}
