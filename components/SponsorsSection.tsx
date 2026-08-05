import { Store, Mail } from 'lucide-react';
import { SUPPORT_CONTACT_EMAIL, type Sponsor } from '@/lib/support';

const sponsorMailto = `mailto:${SUPPORT_CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Patrocinio de Aparkeo',
)}`;

/**
 * Sección «Con el apoyo de» de la página /apoyo. Si no hay patrocinadores
 * configurados muestra una invitación elegante a empresas locales de Vigo;
 * si los hay, los presenta en un grid. Recibe la lista por props para ser
 * presentacional y testeable.
 */
export function SponsorsSection({ sponsors }: { sponsors: Sponsor[] }) {
  if (sponsors.length === 0) {
    return (
      <section aria-labelledby="patrocinio-heading" className="home-fade-up home-fade-up-delay-2">
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-8 text-center backdrop-blur-xl">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/60 text-primary">
            <Store className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 id="patrocinio-heading" className="text-lg font-bold tracking-tight">
            Con el apoyo de… ¿tu negocio?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            ¿Tienes un negocio en Vigo y quieres apoyar la movilidad accesible en tu ciudad? Tu logo
            puede aparecer aquí, junto a un proyecto que usa la comunidad cada día. Escríbenos y te
            contamos cómo funciona.
          </p>
          <a
            href={sponsorMailto}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-sm transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-secondary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0"
          >
            <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
            Quiero patrocinar
          </a>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="patrocinio-heading" className="home-fade-up home-fade-up-delay-2 space-y-4">
      <h2 id="patrocinio-heading" className="text-center text-lg font-bold tracking-tight">
        Con el apoyo de
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sponsors.map((sponsor) => (
          <li key={sponsor.name}>
            {sponsor.url ? (
              <a
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-16 items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/90 px-5 py-4 font-semibold shadow-elevated backdrop-blur-xl transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-elevated-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {sponsor.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- logos de patrocinadores servidos tal cual
                  <img src={sponsor.logo} alt="" className="h-8 w-auto" aria-hidden="true" />
                ) : null}
                {sponsor.name}
              </a>
            ) : (
              <div className="flex min-h-16 items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/90 px-5 py-4 font-semibold shadow-elevated backdrop-blur-xl">
                {sponsor.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- logos de patrocinadores servidos tal cual
                  <img src={sponsor.logo} alt="" className="h-8 w-auto" aria-hidden="true" />
                ) : null}
                {sponsor.name}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
