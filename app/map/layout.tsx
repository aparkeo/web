import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mapa',
  description: 'Mapa interactivo de plazas PMR en Vigo con estado en tiempo real.',
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
