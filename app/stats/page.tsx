import type { Metadata } from 'next';
import { StatsDashboard } from '@/components/StatsDashboard';

export const metadata: Metadata = {
  title: 'Estadísticas',
  description: 'Estadísticas en vivo de plazas PMR libres y ocupadas en Vigo.',
};

export default function StatsPage() {
  return (
    <div className="container max-w-5xl py-8">
      <h1 className="mb-6 text-2xl font-extrabold">Estadísticas</h1>
      <StatsDashboard />
    </div>
  );
}
