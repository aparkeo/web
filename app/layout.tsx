import type { Metadata, Viewport } from 'next';
import { Navbar } from '@/components/Navbar';
import { SITE_URL, SITE_TAGLINE, SITE_DESCRIPTION } from '@/lib/site';
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
    default: `MinusVigo — ${SITE_TAGLINE.split(',')[0]}`,
    template: '%s · MinusVigo',
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
  authors: [{ name: 'MinusVigo' }],
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: SITE_URL,
    siteName: 'MinusVigo',
    title: `MinusVigo — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    // Las imágenes (PNG 1200×630) las generan app/opengraph-image.tsx y
    // app/twitter-image.tsx por convención de archivos de Next.
  },
  twitter: {
    card: 'summary_large_image',
    title: `MinusVigo — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MinusVigo',
  },
  icons: {
    icon: { url: '/icon.svg', type: 'image/svg+xml' },
    apple: '/icons/icon-192.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <a href="#main-content" className="skip-to-content">
          Saltar al contenido principal
        </a>
        <Providers>
          <Navbar />
          {/* tabIndex=-1 permite que el enlace «Saltar al contenido principal»
              mueva el foco al <main> (un <main> no es focuseable por defecto) */}
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
