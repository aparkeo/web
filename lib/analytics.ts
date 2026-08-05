import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Panel de analítica de ciudad (roadmap nº15).
//
// Toda la agregación pesada se hace EN BASE DE DATOS ($queryRaw con
// GROUP BY / FILTER); el servidor solo rellena buckets vacíos y calcula
// porcentajes. Nunca se cargan filas de `reports` a memoria.
//
// Zona horaria: `reportedAt` es `timestamp without time zone` y la sesión
// de la DB corre en UTC (Supabase), así que los buckets por hora/día se
// calculan convirtiendo a hora local de Vigo:
//   (reportedAt AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid'
// ---------------------------------------------------------------------------

export const ANALYTICS_MIN_DAYS = 7;
export const ANALYTICS_MAX_DAYS = 90;
export const ANALYTICS_DEFAULT_DAYS = 30;

/** Marca interna para el bucket de calles sin asignar en el SQL. */
export const UNASSIGNED_KEY = '__UNASSIGNED__';
export const UNASSIGNED_LABEL = 'Sin calle asignada';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Etiquetas cortas de día de la semana (índice 0 = lunes). */
export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

// ---------------------------------------------------------------------------
// Tipos del DTO que consume la UI
// ---------------------------------------------------------------------------

export interface AnalyticsKpis {
  totalSpots: number;
  free: number;
  occupied: number;
  unknown: number;
  totalReports: number;
  reportsLast7d: number;
  /** Personas distintas que han reportado alguna vez (solo el número). */
  reporters: number;
}

export interface HourlyBucket {
  hour: number; // 0-23, hora local de Vigo
  free: number;
  occupied: number;
}

export interface WeekdayBucket {
  /** 0 = lunes … 6 = domingo */
  day: number;
  label: string;
  free: number;
  occupied: number;
}

export interface DailyBucket {
  /** YYYY-MM-DD, día local de Vigo */
  date: string;
  free: number;
  occupied: number;
  total: number;
}

export interface StreetAggregate {
  street: string;
  reports: number;
  free: number;
  occupied: number;
  /** % de reportes OCCUPIED (0-100, redondeado). 0 si no hay reportes. */
  occupiedPct: number;
  /** true si es el bucket agregado de plazas sin calle asignada. */
  unassigned: boolean;
}

export interface TopSpot {
  id: number;
  street: string;
  reports: number;
  occupiedPct: number;
}

/** Visitas con UTM de un canal (utm_source) en la ventana temporal. */
export interface ChannelAggregate {
  source: string;
  visits: number;
}

export interface CityAnalytics {
  windowDays: number;
  generatedAt: string;
  kpis: AnalyticsKpis;
  hourly: HourlyBucket[];
  weekdays: WeekdayBucket[];
  daily: DailyBucket[];
  streets: StreetAggregate[];
  topSpots: TopSpot[];
  /** Visitas medidas por canal UTM (difusión con QRs/enlaces), ventana actual. */
  channels: ChannelAggregate[];
  /** Total de visitas con UTM en la ventana (suma de channels). */
  trackedVisits: number;
  /** Reportes en la ventana temporal; false → la UI muestra estados vacíos. */
  hasData: boolean;
}

// ---------------------------------------------------------------------------
// Funciones puras de agregación (testeables sin DB)
// ---------------------------------------------------------------------------

/** ¿Calle sin asignar en el dataset oficial? (vacía o "(Sin Asignar)"). */
export function isUnassignedStreet(street: string): boolean {
  const s = street.trim().toLowerCase();
  return s === '' || s === '(sin asignar)' || s === 'sin asignar';
}

export function clampWindowDays(days: number): number {
  if (!Number.isFinite(days)) return ANALYTICS_DEFAULT_DAYS;
  return Math.min(ANALYTICS_MAX_DAYS, Math.max(ANALYTICS_MIN_DAYS, Math.round(days)));
}

export function pctOccupied(free: number, occupied: number): number {
  const total = free + occupied;
  if (total <= 0) return 0;
  return Math.round((occupied / total) * 100);
}

/** Rellena las 24 horas (0-23) con ceros donde la DB no devolvió filas. */
export function buildHourlyBuckets(rows: { hour: number; free: number; occupied: number }[]): HourlyBucket[] {
  const byHour = new Map(rows.map((r) => [r.hour, r]));
  return Array.from({ length: 24 }, (_, hour) => {
    const row = byHour.get(hour);
    return { hour, free: row?.free ?? 0, occupied: row?.occupied ?? 0 };
  });
}

/** Rellena los 7 días de semana. La DB devuelve ISODOW (1 = lunes … 7 = domingo). */
export function buildWeekdayBuckets(rows: { dow: number; free: number; occupied: number }[]): WeekdayBucket[] {
  const byDow = new Map(rows.map((r) => [r.dow, r]));
  return Array.from({ length: 7 }, (_, day) => {
    const row = byDow.get(day + 1);
    return { day, label: WEEKDAY_LABELS[day], free: row?.free ?? 0, occupied: row?.occupied ?? 0 };
  });
}

/** Clave YYYY-MM-DD de una fecha en hora local de Vigo (misma que el SQL). */
export function dayKeyVigo(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(date);
}

/**
 * Rellena la tendencia diaria: `days` días terminando hoy (hora de Vigo),
 * con ceros en los días sin reportes.
 */
export function buildDailyTrend(
  rows: { day: string; free: number; occupied: number }[],
  days: number,
  now: Date,
): DailyBucket[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: DailyBucket[] = [];
  // Empezamos por el día más antiguo: hoy - (days - 1)
  const start = new Date(now.getTime() - (days - 1) * DAY_MS);
  for (let i = 0; i < days; i++) {
    const date = dayKeyVigo(new Date(start.getTime() + i * DAY_MS));
    const row = byDay.get(date);
    const free = row?.free ?? 0;
    const occupied = row?.occupied ?? 0;
    out.push({ date, free, occupied, total: free + occupied });
  }
  return out;
}

/**
 * Normaliza las filas por calle: el bucket UNASSIGNED_KEY pasa a tener
 * etiqueta legible y se ordena al final (las calles con nombre mandan).
 */
export function buildStreetAggregates(
  rows: { street: string; reports: number; free: number; occupied: number }[],
): StreetAggregate[] {
  const mapped = rows.map((r) => {
    const unassigned = r.street === UNASSIGNED_KEY || isUnassignedStreet(r.street);
    return {
      street: unassigned ? UNASSIGNED_LABEL : r.street,
      reports: r.reports,
      free: r.free,
      occupied: r.occupied,
      occupiedPct: pctOccupied(r.free, r.occupied),
      unassigned,
    };
  });
  return mapped.sort((a, b) => {
    if (a.unassigned !== b.unassigned) return a.unassigned ? 1 : -1;
    return b.reports - a.reports;
  });
}

export function buildTopSpots(rows: { id: number; street: string; reports: number; occupied: number; free: number }[]): TopSpot[] {
  return rows.map((r) => ({
    id: r.id,
    street: isUnassignedStreet(r.street) ? UNASSIGNED_LABEL : r.street.trim(),
    reports: r.reports,
    occupiedPct: pctOccupied(r.free, r.occupied),
  }));
}

/**
 * Normaliza las filas de visitas por canal: descarta fuentes vacías/nulas
 * (metadata malformada) y ordena por visitas desc, con desempate alfabético
 * estable para que el panel no "baile" entre cargas.
 */
export function buildChannelAggregates(rows: { source: string | null; visits: number }[]): ChannelAggregate[] {
  return rows
    .filter((r): r is { source: string; visits: number } => typeof r.source === 'string' && r.source.trim() !== '')
    .map((r) => ({ source: r.source.trim(), visits: r.visits }))
    .sort((a, b) => b.visits - a.visits || a.source.localeCompare(b.source));
}

// ---------------------------------------------------------------------------
// Consultas (todo el GROUP BY ocurre en Postgres)
// ---------------------------------------------------------------------------

interface StreetRow {
  street: string;
  reports: number;
  free: number;
  occupied: number;
}

interface HourRow {
  hour: number;
  free: number;
  occupied: number;
}

interface DowRow {
  dow: number;
  free: number;
  occupied: number;
}

interface DayRow {
  day: string;
  free: number;
  occupied: number;
}

interface TopSpotRow {
  id: number;
  street: string;
  reports: number;
  free: number;
  occupied: number;
}

interface ChannelRow {
  source: string | null;
  visits: number;
}

/**
 * Agregados de ciudad para el panel público. Solo devuelve números ya
 * agregados: nunca userIds ni trazas individuales (privacidad por diseño).
 */
export async function getCityAnalytics(days: number = ANALYTICS_DEFAULT_DAYS): Promise<CityAnalytics> {
  const windowDays = clampWindowDays(days);
  const now = new Date();
  const since = new Date(now.getTime() - windowDays * DAY_MS);
  const since7d = new Date(now.getTime() - 7 * DAY_MS);

  const [
    totalSpots,
    free,
    occupied,
    totalReports,
    reportsLast7d,
    reporterGroups,
    streetRows,
    hourRows,
    dowRows,
    dayRows,
    topSpotRows,
    channelRows,
  ] = await Promise.all([
    prisma.parkingSpot.count(),
    prisma.parkingSpot.count({ where: { status: 'FREE' } }),
    prisma.parkingSpot.count({ where: { status: 'OCCUPIED' } }),
    prisma.report.count(),
    prisma.report.count({ where: { reportedAt: { gte: since7d } } }),
    prisma.report.groupBy({ by: ['userId'] }),
    // Ocupación por zonas (por calle; las "(Sin Asignar)" se agrupan en un
    // único bucket para no ensuciar el ranking con ruido).
    prisma.$queryRaw<StreetRow[]>`
      SELECT
        CASE
          WHEN btrim(ps.street) = '' OR lower(btrim(ps.street)) IN ('(sin asignar)', 'sin asignar')
          THEN ${UNASSIGNED_KEY}
          ELSE btrim(ps.street)
        END AS street,
        COUNT(*)::int AS reports,
        COUNT(*) FILTER (WHERE r.status = 'FREE')::int AS free,
        COUNT(*) FILTER (WHERE r.status = 'OCCUPIED')::int AS occupied
      FROM reports r
      JOIN parking_spots ps ON ps.id = r."spotId"
      WHERE r."reportedAt" >= ${since}
      GROUP BY 1
      ORDER BY reports DESC
      LIMIT 12
    `,
    // Histograma por hora del día (hora local de Vigo).
    prisma.$queryRaw<HourRow[]>`
      SELECT
        EXTRACT(HOUR FROM (r."reportedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::int AS hour,
        COUNT(*) FILTER (WHERE r.status = 'FREE')::int AS free,
        COUNT(*) FILTER (WHERE r.status = 'OCCUPIED')::int AS occupied
      FROM reports r
      WHERE r."reportedAt" >= ${since}
      GROUP BY 1
    `,
    // Histograma por día de la semana (ISODOW: 1 = lunes … 7 = domingo).
    prisma.$queryRaw<DowRow[]>`
      SELECT
        EXTRACT(ISODOW FROM (r."reportedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::int AS dow,
        COUNT(*) FILTER (WHERE r.status = 'FREE')::int AS free,
        COUNT(*) FILTER (WHERE r.status = 'OCCUPIED')::int AS occupied
      FROM reports r
      WHERE r."reportedAt" >= ${since}
      GROUP BY 1
    `,
    // Tendencia diaria de la ventana (día local de Vigo).
    prisma.$queryRaw<DayRow[]>`
      SELECT
        to_char(date_trunc('day', (r."reportedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid'), 'YYYY-MM-DD') AS day,
        COUNT(*) FILTER (WHERE r.status = 'FREE')::int AS free,
        COUNT(*) FILTER (WHERE r.status = 'OCCUPIED')::int AS occupied
      FROM reports r
      WHERE r."reportedAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `,
    // Plazas más reportadas de la ventana.
    prisma.$queryRaw<TopSpotRow[]>`
      SELECT
        ps.id,
        btrim(ps.street) AS street,
        COUNT(*)::int AS reports,
        COUNT(*) FILTER (WHERE r.status = 'FREE')::int AS free,
        COUNT(*) FILTER (WHERE r.status = 'OCCUPIED')::int AS occupied
      FROM reports r
      JOIN parking_spots ps ON ps.id = r."spotId"
      WHERE r."reportedAt" >= ${since}
      GROUP BY ps.id, ps.street
      ORDER BY reports DESC
      LIMIT 10
    `,
    // Visitas por canal UTM (difusión con QRs/enlaces): GROUP BY sobre el
    // JSONB directamente en Postgres, sin cargar eventos a memoria. Solo el
    // utm_source (el canal); el source es siempre válido por la validación
    // de /api/track, pero se defiende el NOT NULL por si hubiera filas
    // manuales. Sin userIds ni trazas individuales: solo el contador.
    prisma.$queryRaw<ChannelRow[]>`
      SELECT
        metadata->>'source' AS source,
        COUNT(*)::int AS visits
      FROM events
      WHERE type = 'utm_visit' AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY visits DESC
    `,
  ]);

  const daily = buildDailyTrend(dayRows, windowDays, now);
  const windowReports = daily.reduce((acc, d) => acc + d.total, 0);
  const channels = buildChannelAggregates(channelRows);

  return {
    windowDays,
    generatedAt: now.toISOString(),
    kpis: {
      totalSpots,
      free,
      occupied,
      unknown: totalSpots - free - occupied,
      totalReports,
      reportsLast7d,
      reporters: reporterGroups.length,
    },
    hourly: buildHourlyBuckets(hourRows),
    weekdays: buildWeekdayBuckets(dowRows),
    daily,
    streets: buildStreetAggregates(streetRows),
    topSpots: buildTopSpots(topSpotRows),
    channels,
    trackedVisits: channels.reduce((acc, c) => acc + c.visits, 0),
    hasData: windowReports > 0,
  };
}
