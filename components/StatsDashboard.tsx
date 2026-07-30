'use client';

import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { StatsSummary } from '@/types';

async function fetchStats(): Promise<StatsSummary> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('No se pudieron cargar las estadísticas');
  return res.json();
}

const COLORS = { Libres: '#16A34A', Ocupadas: '#DC2626', 'Sin datos': '#94A3B8' };

export function StatsDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['stats'], queryFn: fetchStats, refetchInterval: 60_000 });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  const pieData = [
    { name: 'Libres', value: data.free },
    { name: 'Ocupadas', value: data.occupied },
    { name: 'Sin datos', value: data.unknown },
  ];

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
          <Card key={c.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-3xl font-extrabold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado actual de las plazas</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
