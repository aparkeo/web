import type { Metadata } from 'next';

// La página /map es un client component y no puede exportar metadata;
// el layout del segmento sí.
export const metadata: Metadata = {
  title: 'Mapa de plazas PMR',
  description:
    'Mapa interactivo de plazas de aparcamiento PMR en Vigo con su estado en tiempo real: libres, ocupadas y reportes de la comunidad.',
  alternates: { canonical: '/map' },
  openGraph: {
    title: 'Mapa de plazas PMR en Vigo | Aparkeo Vigo',
    description:
      'Explora el mapa de plazas de aparcamiento PMR en Vigo y mira cuáles están libres ahora mismo.',
  },
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
