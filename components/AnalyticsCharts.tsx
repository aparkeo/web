'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useT } from '@/components/i18n/I18nProvider';
import { fmt } from '@/lib/i18n/format';
import type { DailyBucket, HourlyBucket, WeekdayBucket } from '@/lib/analytics';
import { ANALYTICS_COLORS } from '@/components/analyticsColors';

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius)',
  fontSize: '0.8125rem',
} as const;

const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 } as const;

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      {label}
    </div>
  );
}

/** Histograma de reportes por hora del día (Libre/Ocupada apilados). */
export function HourlyChart({ data }: { data: HourlyBucket[] }) {
  const t = useT();
  if (data.every((b) => b.free + b.occupied === 0)) {
    return <EmptyChart label={t.analytics.emptyWeek} />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="hour" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(h: number) => `${h}h`} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(h) => `${h}:00 – ${Number(h) + 1}:00`} />
        <Bar dataKey="free" name={t.status.freePlural} stackId="a" fill={ANALYTICS_COLORS.free} radius={[0, 0, 0, 0]} />
        <Bar dataKey="occupied" name={t.status.occupiedPlural} stackId="a" fill={ANALYTICS_COLORS.occupied} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Reportes por día de la semana (Libre/Ocupada apilados). */
export function WeekdayChart({ data }: { data: WeekdayBucket[] }) {
  const t = useT();
  if (data.every((b) => b.free + b.occupied === 0)) {
    return <EmptyChart label={t.analytics.emptyWeek} />;
  }
  // Las etiquetas llegan de la API en español (Lun, Mar…): se traducen aquí.
  const weekdayLabel = (label: string) =>
    t.analytics.weekdays[label as keyof typeof t.analytics.weekdays] ?? label;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={weekdayLabel} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={weekdayLabel} />
        <Bar dataKey="free" name={t.status.freePlural} stackId="a" fill={ANALYTICS_COLORS.free} radius={[0, 0, 0, 0]} />
        <Bar dataKey="occupied" name={t.status.occupiedPlural} stackId="a" fill={ANALYTICS_COLORS.occupied} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Tendencia diaria de reportes en la ventana temporal. */
export function TrendChart({ data }: { data: DailyBucket[] }) {
  const t = useT();
  if (data.every((b) => b.total === 0)) {
    return <EmptyChart label={t.analytics.emptyPeriod} />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
          tickFormatter={(d: string) => d.slice(5).split('-').reverse().join('/')}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(d) => {
            const [y, m, day] = String(d).split('-');
            return `${day}/${m}/${y}`;
          }}
        />
        <Area type="monotone" dataKey="free" name={t.status.freePlural} stackId="a" stroke={ANALYTICS_COLORS.free} fill={ANALYTICS_COLORS.free} fillOpacity={0.25} />
        <Area type="monotone" dataKey="occupied" name={t.status.occupiedPlural} stackId="a" stroke={ANALYTICS_COLORS.occupied} fill={ANALYTICS_COLORS.occupied} fillOpacity={0.25} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Barra apilada Libre/Ocupada para el resumen del estado actual. */
export function CurrentStatusBar({ free, occupied, unknown }: { free: number; occupied: number; unknown: number }) {
  const t = useT();
  const total = free + occupied + unknown;
  if (total === 0) return <EmptyChart label={t.analytics.noSpotsYet} />;
  const segments = [
    { label: t.status.freePlural, value: free, color: ANALYTICS_COLORS.free },
    { label: t.status.occupiedPlural, value: occupied, color: ANALYTICS_COLORS.occupied },
    { label: t.status.unknown, value: unknown, color: ANALYTICS_COLORS.muted },
  ];
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted" role="img"
        aria-label={fmt(t.analytics.statusBarAria, { free, occupied, unknown, total })}>
        {segments.map((s) =>
          s.value > 0 ? (
            <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }} />
          ) : null,
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}: <strong className="text-foreground">{s.value}</strong> ({Math.round((s.value / total) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  );
}
