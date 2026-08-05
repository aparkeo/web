'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, Clock3, MapPin, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { CityAnalytics } from '@/lib/analytics';
import { ANALYTICS_COLORS } from '@/components/analyticsColors';

// recharts se carga de forma diferida (chunk aparte), mismo patrón que StatsDashboard
const HourlyChart = dynamic(() => import('@/components/AnalyticsCharts').then((m) => m.HourlyChart), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});
const WeekdayChart = dynamic(() => import('@/components/AnalyticsCharts').then((m) => m.WeekdayChart), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});
const TrendChart = dynamic(() => import('@/components/AnalyticsCharts').then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});
const CurrentStatusBar = dynamic(() => import('@/components/AnalyticsCharts').then((m) => m.CurrentStatusBar), {
  ssr: false,
  loading: () => <Skeleton className="h-16 w-full" />,
});

async function fetchAnalytics(): Promise<CityAnalytics> {
  const res = await fetch('/api/analytics');
  if (!res.ok) throw new Error('No se pudo cargar la analítica');
  return res.json();
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-center">
      <BarChart3 className="h-6 w-6 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">{label}</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
        En cuanto la comunidad empiece a reportar, este panel cobrará vida.
      </p>
    </div>
  );
}

export function AnalyticsDashboard() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['city-analytics'],
    queryFn: fetchAnalytics,
    // La API cachea 5 min en CDN; no tiene sentido refetchear más rápido.
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data) {
    if (isError) {
      return (
        <Card className="rounded-2xl shadow-elevated">
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm font-medium">No se pudo cargar la analítica de la ciudad.</p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="btn-cta min-h-11 rounded-full px-5 text-sm font-semibold"
            >
              Reintentar
            </button>
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const { kpis } = data;
  const kpiCards = [
    { label: 'Plazas registradas', value: kpis.totalSpots, icon: MapPin },
    { label: 'Libres ahora', value: kpis.free, icon: Activity },
    { label: 'Ocupadas ahora', value: kpis.occupied, icon: Activity },
    { label: `Reportes (${data.windowDays} días)`, value: data.daily.reduce((a, d) => a + d.total, 0), icon: BarChart3 },
    { label: 'Reportes (7 días)', value: kpis.reportsLast7d, icon: Clock3 },
    { label: 'Personas que han reportado', value: kpis.reporters, icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs de cabecera */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((c) => (
          <Card key={c.label} className="rounded-2xl shadow-elevated">
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{c.label}</p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight">{c.value}</p>
              </div>
              <c.icon className="mt-1 h-5 w-5 text-primary" aria-hidden />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Estado actual */}
      <Card className="rounded-2xl shadow-elevated">
        <CardHeader>
          <CardTitle className="tracking-tight">Estado actual de las plazas</CardTitle>
          <CardDescription>Último consenso conocido de cada plaza, ahora mismo.</CardDescription>
        </CardHeader>
        <CardContent>
          <CurrentStatusBar free={kpis.free} occupied={kpis.occupied} unknown={kpis.unknown} />
        </CardContent>
      </Card>

      {!data.hasData ? (
        <Card className="rounded-2xl shadow-elevated">
          <CardContent className="p-6">
            <EmptyPanel label={`Aún no hay suficientes datos en los últimos ${data.windowDays} días`} />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Horas punta + semana */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-2xl shadow-elevated">
              <CardHeader>
                <CardTitle className="tracking-tight">Horas punta</CardTitle>
                <CardDescription>Reportes por hora del día, últimos {data.windowDays} días.</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <HourlyChart data={data.hourly} />
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-elevated">
              <CardHeader>
                <CardTitle className="tracking-tight">Ritmo semanal</CardTitle>
                <CardDescription>Reportes por día de la semana.</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <WeekdayChart data={data.weekdays} />
              </CardContent>
            </Card>
          </div>

          {/* Tendencia */}
          <Card className="rounded-2xl shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 tracking-tight">
                <TrendingUp className="h-5 w-5 text-primary" aria-hidden /> Tendencia de actividad
              </CardTitle>
              <CardDescription>Reportes por día en los últimos {data.windowDays} días.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <TrendChart data={data.daily} />
            </CardContent>
          </Card>

          {/* Ocupación por zonas */}
          <Card className="rounded-2xl shadow-elevated">
            <CardHeader>
              <CardTitle className="tracking-tight">Ocupación por zonas</CardTitle>
              <CardDescription>
                Calles con más actividad en los últimos {data.windowDays} días. El porcentaje indica cuántos
                reportes fueron de «ocupada».
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.streets.length === 0 ? (
                <EmptyPanel label="Aún no hay suficientes datos por zonas" />
              ) : (
                <ul className="space-y-4">
                  {data.streets.map((s) => (
                    <li key={s.street}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-semibold">
                          {s.street}
                          {s.unassigned ? (
                            <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
                              (agrupadas)
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {s.reports} reportes · {s.occupiedPct}% ocupada
                        </span>
                      </div>
                      <div
                        className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                        role="img"
                        aria-label={`${s.street}: ${s.occupiedPct}% de reportes de ocupada`}
                      >
                        <div style={{ width: `${100 - s.occupiedPct}%`, backgroundColor: ANALYTICS_COLORS.free }} />
                        <div style={{ width: `${s.occupiedPct}%`, backgroundColor: ANALYTICS_COLORS.occupied }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {data.streets.some((s) => s.unassigned) ? (
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Las plazas del dataset oficial sin calle asignada se agrupan en un único bloque para no distorsionar
                  el ranking por calles.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {/* Plazas más reportadas */}
          <Card className="rounded-2xl shadow-elevated">
            <CardHeader>
              <CardTitle className="tracking-tight">Plazas más reportadas</CardTitle>
              <CardDescription>Top {data.topSpots.length} por actividad de la comunidad.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topSpots.length === 0 ? (
                <EmptyPanel label="Aún no hay plazas con reportes suficientes" />
              ) : (
                <ol className="divide-y divide-border">
                  {data.topSpots.map((spot, i) => (
                    <li key={spot.id}>
                      <Link
                        href={`/spots/${spot.id}`}
                        className="flex min-h-11 items-center gap-3 py-2.5 transition-colors duration-150 hover:bg-secondary/60 sm:rounded-lg sm:px-3"
                      >
                        <span className="w-6 shrink-0 text-sm font-extrabold text-muted-foreground">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{spot.street}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {spot.reports} reportes · {spot.occupiedPct}% ocupada
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Datos agregados y anónimos de los últimos {data.windowDays} días (los KPIs de «ahora» reflejan el estado
        actual). Nunca se publican datos personales ni trazas individuales.
      </p>
    </div>
  );
}
