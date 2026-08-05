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

export const metadata: Metadata = {
  title: 'MinusVigo para instituciones',
  description:
    'Datos de movilidad PMR en tiempo real, generados por la ciudadanía, al servicio de ayuntamientos, diputaciones y entidades del tercer sector. Piloto gratuito con el Concello de Vigo: la plataforma ya está construida y operativa.',
  alternates: { canonical: '/instituciones' },
};

const contactMailto = `mailto:${SUPPORT_CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Colaboración institucional — MinusVigo',
)}`;

const ctaButtonClass =
  'btn-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface Offering {
  Icon: LucideIcon;
  title: string;
  body: string;
}

const OFFERINGS: Offering[] = [
  {
    Icon: MapPinned,
    title: 'Mapa en tiempo real de plazas PMR',
    body: 'Cada plaza de movilidad reducida del municipio con su estado (libre u ocupada) alimentado por reportes ciudadanos verificados con GPS. Información operativa que hoy ninguna administración tiene sin instalar sensores.',
  },
  {
    Icon: BarChart3,
    title: 'Datos agregados de ocupación y demanda',
    body: 'Histórico de reportes convertible en evidencia para la planificación urbana: qué zonas necesitan más plazas PMR, en qué franjas se concentra la presión y dónde conviene actuar primero.',
  },
  {
    Icon: MessagesSquare,
    title: 'Canal ciudadano verificado',
    body: 'Reportes con fotos, comentarios y notificaciones push. Participación ciudadana real sobre accesibilidad sin coste de desarrollo, contratación ni mantenimiento para la administración.',
  },
  {
    Icon: ShieldCheck,
    title: 'Tecnología transparente y auditable',
    body: 'Código disponible para auditoría institucional, cumplimiento del RGPD por diseño (exportación y borrado de datos en self-service) y despliegue en infraestructura europea. Sin caja negra ni dependencia de proveedor.',
  },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Piloto gratuito de 6 meses',
    body: 'Con el Concello de Vigo, sin coste ni compromiso. La plataforma ya funciona hoy: el piloto empieza cuando la institución lo decida, no cuando termine un desarrollo.',
  },
  {
    title: 'Evaluación con datos reales',
    body: 'Al cierre del piloto, informe de impacto construido sobre los datos agregados de uso y demanda: qué aportó el canal ciudadano y qué zonas concentran la necesidad.',
  },
  {
    title: 'Acuerdo de mantenimiento y extensión',
    body: 'Si la evaluación es positiva, acuerdo de mantenimiento a coste ajustado y posibilidad de extender la plataforma a otros municipios de la provincia o la comunidad autónoma.',
  },
];

/**
 * Landing institucional (B2G/B2B): la página que se enseña a ayuntamientos,
 * diputaciones y entidades del tercer sector para vender la plataforma.
 * Server component estático, sin cifras de tracción inventadas: se habla de
 * capacidades de la plataforma, no de estadísticas de uso.
 */
export default function InstitucionesPage() {
  return (
    <div className="container max-w-3xl space-y-6 pb-16 pt-10 sm:pt-14">
      <header className="home-fade-up space-y-4 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-primary shadow-elevated backdrop-blur-xl">
          <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
          Para instituciones
        </p>
        <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          Datos de movilidad PMR en tiempo real, al servicio de las administraciones
        </h1>
        <p className="mx-auto max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          MinusVigo convierte la participación ciudadana en información operativa sobre las plazas de
          aparcamiento para personas con movilidad reducida. Una plataforma ya construida y operativa,
          lista para pilotar con ayuntamientos, diputaciones y entidades del tercer sector.
        </p>
        <p className="pt-1">
          <a href={contactMailto} className={ctaButtonClass}>
            <Mail className="h-4 w-4" aria-hidden="true" />
            Contactar para colaborar
          </a>
        </p>
      </header>

      <section aria-labelledby="ofrece-heading" className="home-fade-up home-fade-up-delay space-y-4">
        <h2 id="ofrece-heading" className="text-center text-xl font-bold tracking-tight sm:text-2xl">
          Qué ofrece la plataforma
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Contexto</p>
          <CardTitle className="tracking-tight">Por qué ahora</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            La <strong className="text-foreground">Agenda Urbana Española</strong>, los fondos
            europeos de inclusión y movilidad sostenible —como la{' '}
            <strong className="text-foreground">European Urban Initiative</strong> y la{' '}
            <strong className="text-foreground">Nueva Bauhaus Europea</strong>— y los planes de
            accesibilidad autonómicos financian precisamente este tipo de proyectos: accesibilidad
            real, participación ciudadana y datos para decidir mejor.
          </p>
          <p>
            La diferencia de MinusVigo es que{' '}
            <strong className="text-foreground">la plataforma ya está construida y operativa</strong>
            . No hay que presupuestar un desarrollo ni esperar meses de ejecución: el riesgo técnico
            del piloto es cero, y cada euro de una eventual colaboración va a operación y mejora, no
            a construir lo que ya existe.
          </p>
        </CardContent>
      </Card>

      <section aria-labelledby="modelo-heading" className="home-fade-up home-fade-up-delay-2 space-y-4">
        <h2 id="modelo-heading" className="text-center text-xl font-bold tracking-tight sm:text-2xl">
          Modelo de colaboración
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
          Hablemos de un piloto
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Si representas a un ayuntamiento, una diputación o una entidad del tercer sector y quieres
          explorar una colaboración, escríbenos y preparamos una propuesta concreta.
        </p>
        <p className="mt-5">
          <a href={contactMailto} className={ctaButtonClass}>
            <Mail className="h-4 w-4" aria-hidden="true" />
            Contactar para colaborar
          </a>
        </p>
        <p className="mt-6 flex items-start justify-center gap-2 text-sm leading-relaxed text-muted-foreground">
          <Heart className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            ¿Eres un particular? También puedes{' '}
            <Link
              href="/apoyo"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              apoyar el proyecto
            </Link>
            .
          </span>
        </p>
      </section>
    </div>
  );
}
