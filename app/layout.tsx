import type { Metadata, Viewport } from 'next';
import { Navbar } from '@/components/Navbar';
import { Providers } from './providers';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://minusvigo.app';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0D776B' },
    { media: '(prefers-color-scheme: dark)', color: '#0C0E1C' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'MinusVigo — Plazas PMR libres en Vigo',
    template: '%s · MinusVigo',
  },
  description:
    'Encuentra plazas de aparcamiento PMR libres en Vigo en tiempo real. Mapa, predicciones inteligentes y reportes de la comunidad.',
  keywords: ['PMR', 'aparcamiento', 'Vigo', 'movilidad reducida', 'parking accesible'],
  authors: [{ name: 'MinusVigo' }],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: SITE_URL,
    siteName: 'MinusVigo',
    title: 'MinusVigo — Plazas PMR libres en Vigo',
    description: 'Encuentra plazas de aparcamiento PMR libres en Vigo en tiempo real.',
    images: [{ url: '/og-image.svg', width: 1200, height: 630, alt: 'MinusVigo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MinusVigo — Plazas PMR libres en Vigo',
    description: 'Encuentra plazas de aparcamiento PMR libres en Vigo en tiempo real.',
    images: ['/og-image.svg'],
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
          <main id="main-content">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
