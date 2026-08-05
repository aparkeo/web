import type { Metadata, Viewport } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SITE_URL, SITE_TAGLINE, SITE_DESCRIPTION } from '@/lib/site';
import { getDictionary } from '@/lib/i18n';
import { getServerLocale } from '@/lib/i18n/server';
import { Providers } from './providers';
import './globals.css';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0D776B' },
    { media: '(prefers-color-scheme: dark)', color: '#0C0E1C' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `Aparkeo Vigo — ${SITE_TAGLINE.split(',')[0]}`,
    template: '%s · Aparkeo',
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'PMR Vigo',
    'aparcamiento movilidad reducida',
    'plazas PMR libres',
    'parking accesible Vigo',
    'aparcamiento Vigo',
    'movilidad reducida',
    'discapacidad Vigo',
  ],
  authors: [{ name: 'Aparkeo' }],
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: SITE_URL,
    siteName: 'Aparkeo Vigo',
    title: `Aparkeo Vigo — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    // Las imágenes (PNG 1200×630) las generan app/opengraph-image.tsx y
    // app/twitter-image.tsx por convención de archivos de Next.
  },
  twitter: {
    card: 'summary_large_image',
    title: `Aparkeo Vigo — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Aparkeo',
  },
  icons: {
    icon: { url: '/icon.svg', type: 'image/svg+xml' },
    apple: '/icons/icon-192.png',
  },
};

// La cookie `lang` decide el idioma del SSR (ES por defecto): leerla aquí
// marca las rutas como dinámicas, precio aceptado por tener i18n sin
// segmento [locale] (ver docs/AUDIT-2026-07-31.md, entrada nº27).
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <a href="#main-content" className="skip-to-content">
          {dict.common.skipToContent}
        </a>
        <Providers locale={locale} dict={dict}>
          <Navbar />
          {/* tabIndex=-1 permite que el enlace «Saltar al contenido principal»
              mueva el foco al <main> (un <main> no es focuseable por defecto) */}
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
