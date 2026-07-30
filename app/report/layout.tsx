import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reportar plaza',
  description: 'Reporta el estado de una plaza PMR en Vigo y ayuda a la comunidad.',
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
