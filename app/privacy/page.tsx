import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SITE_GITHUB_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacidad',
  description:
    'Política de privacidad de MinusVigo: qué datos recogemos, para qué, qué base jurídica nos ampara y cómo ejercer tus derechos RGPD (acceso, rectificación, supresión, portabilidad y oposición).',
  alternates: { canonical: '/privacy' },
};

const LAST_UPDATED = '5 de agosto de 2026';

function Section({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="home-fade-up rounded-2xl shadow-elevated">
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{kicker}</p>
        <CardTitle className="tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl space-y-6 pb-16 pt-10 sm:pt-14">
      <header className="home-fade-up space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Privacidad</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          MinusVigo es un proyecto comunitario y sin ánimo de lucro. Esta página explica, en llano, qué
          datos recoge la aplicación, para qué los usa y cómo puedes ejercer tus derechos. Última
          actualización: {LAST_UPDATED}.
        </p>
      </header>

      <Section kicker="Responsable" title="Quién está detrás">
        <p>
          El responsable del tratamiento es <strong className="text-foreground">el mantenedor del proyecto
          MinusVigo</strong>, un proyecto comunitario independiente (no hay empresa ni entidad legal detrás).
        </p>
        <p>
          Para cualquier cuestión de privacidad puedes contactar a través del repositorio público del
          proyecto en GitHub:{' '}
          <a
            href={SITE_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {SITE_GITHUB_URL.replace('https://', '')}
          </a>{' '}
          (abre una issue o usa los canales del repositorio).
        </p>
      </Section>

      <Section kicker="Datos" title="Qué datos recogemos y para qué">
        <p>Solo recogemos lo necesario para que la aplicación funcione:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Cuenta</strong> (nombre, email y contraseña cifrada con
            bcrypt): para identificarte y mostrar tu perfil. Jamás guardamos tu contraseña en claro.
          </li>
          <li>
            <strong className="text-foreground">Reportes de plazas</strong> (plaza, estado libre/ocupada y,
            opcionalmente, las coordenadas GPS y su precisión si las compartes desde tu dispositivo): para
            mantener el mapa en tiempo real y alimentar las predicciones.
          </li>
          <li>
            <strong className="text-foreground">Fotos y comentarios de plazas</strong>: contenido que subes
            voluntariamente para ayudar a la comunidad. Las fotos se almacenan en Supabase Storage.
          </li>
          <li>
            <strong className="text-foreground">Favoritos</strong>: las plazas que marcas, para avisarte y
            mostrártelas en tu perfil.
          </li>
          <li>
            <strong className="text-foreground">Suscripciones push</strong> (endpoint y claves de tu
            dispositivo): solo si activas los avisos, para enviarte notificaciones cuando una plaza favorita
            queda libre.
          </li>
          <li>
            <strong className="text-foreground">Notificaciones</strong>: el historial de avisos que te
            mostramos en la campana.
          </li>
          <li>
            <strong className="text-foreground">Eventos de producto</strong>: analítica propia y ligera.
            Las visitas por canal (UTM) son <strong className="text-foreground">anónimas</strong>: no guardan
            tu usuario, tu IP ni tu navegador. También registramos eventos técnicos como violaciones de la
            política de seguridad de contenido (CSP), igualmente sin datos personales.
          </li>
          <li>
            <strong className="text-foreground">Predicciones</strong>: probabilidades agregadas por plaza,
            calculadas a partir de los reportes; no contienen datos personales.
          </li>
        </ul>
        <p>
          <strong className="text-foreground">No</strong> vendemos datos, no hay publicidad, no usamos
          analítica de terceros (ni Google Analytics ni similares) y no compartimos tus datos con nadie más.
        </p>
      </Section>

      <Section kicker="Base jurídica" title="Por qué podemos tratar estos datos">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Interés legítimo</strong> (art. 6.1.f RGPD): la cuenta, los
            reportes y el funcionamiento del mapa colaborativo son el núcleo del servicio y el tratamiento es
            el mínimo necesario para prestarlo.
          </li>
          <li>
            <strong className="text-foreground">Consentimiento</strong> (art. 6.1.a RGPD): para los avisos
            push y los favoritos, que activas tú y puedes retirar en cualquier momento (desactivando los
            avisos o desmarcando favoritos).
          </li>
        </ul>
      </Section>

      <Section kicker="Terceros" title="Quién accede a los datos y dónde se alojan">
        <p>
          Nadie fuera del proyecto accede a tus datos. La aplicación se aloja en{' '}
          <strong className="text-foreground">Vercel</strong> (servidor y CDN) y la base de datos y las fotos
          en <strong className="text-foreground">Supabase</strong> (PostgreSQL y Storage, con región en la
          Unión Europea). Ambos actúan como encargados del tratamiento y solo procesan los datos para poder
          servir la aplicación.
        </p>
      </Section>

      <Section kicker="Conservación" title="Cuánto tiempo guardamos los datos">
        <p>
          Guardamos tus datos mientras mantengas tu cuenta. Si eliminas tu cuenta, borramos todo lo ligado a
          ella (reportes, favoritos, comentarios, fotos — también los archivos del almacenamiento —,
          notificaciones, suscripciones push, sesiones y eventos). Los eventos anónimos (visitas UTM y
          violaciones CSP) no pueden asociarse a ti y se conservan como estadística agregada.
        </p>
      </Section>

      <Section kicker="Tus derechos" title="Cómo ejercer tus derechos RGPD">
        <p>Tienes derecho de acceso, rectificación, supresión, portabilidad y oposición. Así se ejercen:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Acceso y portabilidad</strong>: desde{' '}
            <Link href="/profile" className="font-semibold text-primary underline-offset-4 hover:underline">
              tu perfil
            </Link>{' '}
            puedes descargar todos tus datos con el botón «Descargar mis datos» (un archivo JSON completo).
          </li>
          <li>
            <strong className="text-foreground">Rectificación</strong>: corrige el contenido que hayas
            publicado borrándolo y volviéndolo a crear (fotos y comentarios los puede borrar su autor).
          </li>
          <li>
            <strong className="text-foreground">Supresión</strong> («derecho al olvido»): desde{' '}
            <Link href="/profile" className="font-semibold text-primary underline-offset-4 hover:underline">
              tu perfil
            </Link>
            , en la «Zona de peligro», puedes eliminar tu cuenta y todos tus datos de forma irreversible.
          </li>
          <li>
            <strong className="text-foreground">Oposición</strong>: desactiva los avisos push desde la
            campana de notificaciones o elimina tu cuenta para oponerte a cualquier tratamiento.
          </li>
        </ul>
        <p>
          Si lo prefieres, también puedes ejercer cualquiera de estos derechos contactando a través del{' '}
          <a
            href={SITE_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            repositorio en GitHub
          </a>
          . Y si crees que tus derechos no se han respetado, puedes reclamar ante la Agencia Española de
          Protección de Datos (AEPD).
        </p>
      </Section>

      <Section kicker="Cookies" title="Almacenamiento técnico y cookies">
        <p>
          MinusVigo <strong className="text-foreground">no usa cookies de terceros ni de publicidad</strong>.
          Solo utiliza almacenamiento técnico estrictamente necesario:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Cookie de sesión</strong> (JWT de NextAuth): para mantener tu
            sesión iniciada. Imprescindible para que la cuenta funcione.
          </li>
          <li>
            <strong className="text-foreground">Preferencias locales</strong> (localStorage): tema
            claro/oscuro, capa del mapa y preferencias de instalación de la app (PWA). Nunca salen de tu
            navegador.
          </li>
          <li>
            <strong className="text-foreground">sessionStorage</strong>: para no contar dos veces la misma
            visita UTM dentro de una sesión de navegador. Se borra al cerrar la pestaña.
          </li>
        </ul>
        <p>
          Las visitas por canal (UTM) que medimos para saber de dónde viene la difusión son anónimas: no
          guardan usuario, IP ni navegador. Al no haber cookies de terceros ni publicidad, la app no necesita
          banner de consentimiento de cookies.
        </p>
      </Section>

      <Section kicker="Cambios" title="Si esta política cambia">
        <p>
          Cualquier cambio relevante se publicará en esta misma página y en el repositorio del proyecto, con
          su fecha de actualización.
        </p>
      </Section>
    </div>
  );
}
