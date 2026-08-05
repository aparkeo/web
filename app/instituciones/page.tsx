import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BarChart3,
  Heart,
  Landmark,
  Mail,
  MapPinned,
  MessagesSquare,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SUPPORT_CONTACT_EMAIL } from '@/lib/support';
import { getServerDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Aparkeo Vigo para instituciones',
  description:
    'Datos de movilidad PMR en tiempo real, generados por la ciudadanía, al servicio de ayuntamientos, diputaciones y entidades del tercer sector. Piloto gratuito con el Concello de Vigo: la plataforma ya está construida y operativa.',
  alternates: { canonical: '/instituciones' },
};

const contactMailto = `mailto:${SUPPORT_CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Colaboración institucional — Aparkeo Vigo',
)}`;

const ctaButtonClass =
  'btn-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface Offering {
  Icon: LucideIcon;
  title: string;
  body: string;
}

/**
 * Landing institucional (B2G/B2B): la página que se enseña a ayuntamientos,
 * diputaciones y entidades del tercer sector para vender la plataforma.
 * Server component, sin cifras de tracción inventadas: se habla de
 * capacidades de la plataforma, no de estadísticas de uso.
 */
export default async function InstitucionesPage() {
  const t = await getServerDictionary();

  const OFFERINGS: Offering[] = [
    { Icon: MapPinned, title: t.instituciones.offering1Title, body: t.instituciones.offering1Body },
    { Icon: BarChart3, title: t.instituciones.offering2Title, body: t.instituciones.offering2Body },
    { Icon: MessagesSquare, title: t.instituciones.offering3Title, body: t.instituciones.offering3Body },
    { Icon: ShieldCheck, title: t.instituciones.offering4Title, body: t.instituciones.offering4Body },
  ];

  const STEPS: { title: string; body: string }[] = [
    { title: t.instituciones.step1Title, body: t.instituciones.step1Body },
    { title: t.instituciones.step2Title, body: t.instituciones.step2Body },
    { title: t.instituciones.step3Title, body: t.instituciones.step3Body },
  ];

  return (
    <div className="container max-w-3xl space-y-6 pb-16 pt-10 sm:pt-14">
      <header className="home-fade-up space-y-4 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-primary shadow-elevated backdrop-blur-xl">
          <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
          {t.instituciones.badge}
        </p>
        <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t.instituciones.title}
        </h1>
        <p className="mx-auto max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t.instituciones.intro}
        </p>
        <p className="pt-1">
          <a href={contactMailto} className={ctaButtonClass}>
            <Mail className="h-4 w-4" aria-hidden="true" />
            {t.instituciones.contactCta}
          </a>
        </p>
      </header>

      <section aria-labelledby="ofrece-heading" className="home-fade-up home-fade-up-delay space-y-4">
        <h2 id="ofrece-heading" className="text-center text-xl font-bold tracking-tight sm:text-2xl">
          {t.instituciones.offeringsTitle}
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {OFFERINGS.map(({ Icon, title, body }) => (
            <li key={title}>
              <Card className="h-full rounded-2xl border-border/60 bg-card/90 bg-gradient-to-b from-accent/15 via-transparent to-transparent shadow-elevated backdrop-blur-xl">
                <CardHeader>
                  <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-accent/60 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <CardTitle className="text-lg tracking-tight">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <Card className="home-fade-up home-fade-up-delay rounded-2xl shadow-elevated">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t.instituciones.contextKicker}</p>
          <CardTitle className="tracking-tight">{t.instituciones.contextTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>{t.instituciones.contextBody1}</p>
          <p>
            {t.instituciones.contextBody2a}
            <strong className="text-foreground">{t.instituciones.contextBody2Strong}</strong>
            {t.instituciones.contextBody2b}
          </p>
        </CardContent>
      </Card>

      <section aria-labelledby="modelo-heading" className="home-fade-up home-fade-up-delay-2 space-y-4">
        <h2 id="modelo-heading" className="text-center text-xl font-bold tracking-tight sm:text-2xl">
          {t.instituciones.modelTitle}
        </h2>
        <ol className="space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Card className="rounded-2xl border-border/60 bg-card/90 shadow-elevated backdrop-blur-xl">
                <CardContent className="flex items-start gap-4 pt-6">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <div className="space-y-1">
                    <h3 className="font-semibold tracking-tight">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="contacto-heading"
        className="home-fade-up home-fade-up-delay-2 rounded-2xl border border-border/60 bg-card/90 bg-gradient-to-b from-accent/15 via-transparent to-transparent px-6 py-8 text-center shadow-elevated backdrop-blur-xl"
      >
        <h2 id="contacto-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t.instituciones.pilotTitle}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {t.instituciones.pilotBody}
        </p>
        <p className="mt-5">
          <a href={contactMailto} className={ctaButtonClass}>
            <Mail className="h-4 w-4" aria-hidden="true" />
            {t.instituciones.contactCta}
          </a>
        </p>
        <p className="mt-6 flex items-start justify-center gap-2 text-sm leading-relaxed text-muted-foreground">
          <Heart className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            {t.instituciones.individualPrefix}
            <Link
              href="/apoyo"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t.instituciones.individualLink}
            </Link>
            .
          </span>
        </p>
      </section>
    </div>
  );
}
