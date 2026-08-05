import type { Metadata } from 'next';

// La página /report es un client component y no puede exportar metadata;
// el layout del segmento sí.
export const metadata: Metadata = {
  title: 'Reportar estado de una plaza',
  description:
    'Reporta si una plaza PMR de Vigo está libre u ocupada. Cada reporte de la comunidad mantiene el mapa fiable para todas las personas con movilidad reducida.',
  alternates: { canonical: '/report' },
  openGraph: {
    title: 'Reportar estado de una plaza PMR | MinusVigo',
    description:
      'Ayuda a la comunidad PMR de Vigo: reporta el estado de las plazas que ves y mantén el mapa al día.',
  },
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
