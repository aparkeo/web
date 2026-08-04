'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime, labelForStatus } from '@/lib/utils';

interface AdminReport {
  id: string;
  status: 'FREE' | 'OCCUPIED';
  weight: number;
  reportedAt: string;
  spot: { street: string };
  user: { name: string | null; email: string };
}

async function fetchReports(): Promise<AdminReport[]> {
  const res = await fetch('/api/admin/reports');
  if (!res.ok) throw new Error('No se pudieron cargar los reportes');
  return res.json();
}

export default function AdminReportsPage() {
  const { data: reports = [], isLoading } = useQuery({ queryKey: ['admin-reports'], queryFn: fetchReports });

  return (
    <div>
      <header className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Administración</p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Reportes recientes</h1>
        <p className="mt-3 max-w-lg text-pretty leading-relaxed text-muted-foreground">
          Últimos informes de la comunidad, con su peso en el consenso.
        </p>
      </header>
      <Card className="rounded-2xl shadow-elevated">
        <CardHeader>
          <CardTitle>Últimos {reports.length} reportes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm transition-colors duration-150 hover:bg-secondary/40">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.spot.street}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.user.name ?? r.user.email} · {formatRelativeTime(new Date(r.reportedAt))} · peso {r.weight}
                  </p>
                </div>
                <Badge variant={r.status === 'FREE' ? 'success' : 'destructive'}>{labelForStatus(r.status)}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
