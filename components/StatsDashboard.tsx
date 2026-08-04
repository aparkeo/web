'use client';

import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { StatsSummary } from '@/types';

// recharts se carga de forma diferida (chunk aparte) con skeleton de fallback
const StatusPieChart = dynamic(
  () => import('@/components/StatusPieChart').then((m) => m.StatusPieChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />,
  },
);

async function fetchStats(): Promise<StatsSummary> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('No se pudieron cargar las estadísticas');
  return res.json();
}

export function StatsDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['stats'], queryFn: fetchStats, refetchInterval: 60_000 });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Plazas totales', value: data.totalSpots },
    { label: 'Reportes (24h)', value: data.reportsLast24h },
    { label: 'Reportes totales', value: data.totalReports },
    { label: 'Usuarios activos (24h)', value: data.activeUsers },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="rounded-2xl shadow-elevated">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{c.label}</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl shadow-elevated">
        <CardHeader>
          <CardTitle className="tracking-tight">Estado actual de las plazas</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <StatusPieChart free={data.free} occupied={data.occupied} unknown={data.unknown} />
        </CardContent>
      </Card>
    </div>
  );
}
