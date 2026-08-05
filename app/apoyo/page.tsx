import type { Metadata } from 'next';
import { Coffee, HandCoins, Heart, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SponsorsSection } from '@/components/SponsorsSection';
import { SPONSORS, SUPPORT_KOFI_URL, SUPPORT_PAYPAL_URL } from '@/lib/support';

export const metadata: Metadata = {
  title: 'Apoya el proyecto',
  description:
    'MinusVigo es un proyecto comunitario y gratuito. Las donaciones y el patrocinio local cubren el servidor, la base de datos, el dominio y el tiempo de desarrollo. El mapa y los reportes serán siempre gratuitos.',
  alternates: { canonical: '/apoyo' },
};

const donationButtonClass =
  'btn-cta inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export default function ApoyoPage() {
  return (
    <div className="container max-w-3xl space-y-6 pb-16 pt-10 sm:pt-14">
      <header className="home-fade-up space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Proyecto comunitario
        </p>
        <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          Apoya MinusVigo
        </h1>
        <p className="mx-auto max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          MinusVigo nació para responder a una pregunta sencilla: ¿dónde hay una plaza PMR libre en
          Vigo, ahora mismo? Lo mantiene una sola persona con la ayuda de la comunidad que reporta,
          sin ánimo de lucro en el núcleo del proyecto.
        </p>
      </header>

      <Card className="home-fade-up home-fade-up-delay rounded-2xl shadow-elevated">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Transparencia</p>
          <CardTitle className="flex items-center gap-2 tracking-tight">
            <Server className="h-5 w-5 text-primary" aria-hidden="true" />
            ¿Qué cubren las aportaciones?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            La aplicación es gratis y lo seguirá siendo, pero mantenerla no lo es. Cada aportación
            va íntegramente a:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Servidor y base de datos</strong> (Vercel y
              Supabase), que sostienen el mapa en tiempo real y las notificaciones.
            </li>
            <li>
              <strong className="text-foreground">Dominio y servicios</strong> asociados al
              proyecto.
            </li>
            <li>
              <strong className="text-foreground">Tiempo de desarrollo</strong>: nuevas funciones,
              correcciones y mejoras de accesibilidad que pide la comunidad.
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="home-fade-up home-fade-up-delay grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl border-border/60 bg-card/90 bg-gradient-to-b from-accent/15 via-transparent to-transparent shadow-elevated backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
              <Coffee className="h-5 w-5 text-primary" aria-hidden="true" />
              Invítanos a un café
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Donación puntual por Ko-fi, del importe que tú elijas. Sin cuentas ni compromisos: un
              café para seguir programando.
            </p>
            <a
              href={SUPPORT_KOFI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={donationButtonClass}
            >
              <Coffee className="h-4 w-4" aria-hidden="true" />
              Donar con Ko-fi
            </a>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 bg-card/90 bg-gradient-to-b from-accent/15 via-transparent to-transparent shadow-elevated backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
              <HandCoins className="h-5 w-5 text-primary" aria-hidden="true" />
              Donación por PayPal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Si prefieres PayPal, también puedes aportar por ahí. Mismo destino: mantener el mapa
              vivo y mejorando.
            </p>
            <a
              href={SUPPORT_PAYPAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={donationButtonClass}
            >
              <HandCoins className="h-4 w-4" aria-hidden="true" />
              Donar con PayPal
            </a>
          </CardContent>
        </Card>
      </div>

      <SponsorsSection sponsors={SPONSORS} />

      <p className="home-fade-up home-fade-up-delay-2 flex items-start justify-center gap-2 text-center text-sm leading-relaxed text-muted-foreground">
        <Heart className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span>
          El mapa y los reportes serán siempre gratuitos. Apoyar es voluntario y no desbloquea ni
          bloquea ninguna función: es solo una forma de ayudar a que MinusVigo siga existiendo.
        </span>
      </p>
    </div>
  );
}
