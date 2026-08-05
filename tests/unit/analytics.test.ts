import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_DEFAULT_DAYS,
  ANALYTICS_MAX_DAYS,
  ANALYTICS_MIN_DAYS,
  UNASSIGNED_KEY,
  UNASSIGNED_LABEL,
  buildChannelAggregates,
  buildDailyTrend,
  buildHourlyBuckets,
  buildStreetAggregates,
  buildTopSpots,
  buildWeekdayBuckets,
  clampWindowDays,
  isUnassignedStreet,
  pctOccupied,
} from '@/lib/analytics';

describe('isUnassignedStreet', () => {
  it('detecta vacías y variantes de "(Sin Asignar)"', () => {
    expect(isUnassignedStreet('')).toBe(true);
    expect(isUnassignedStreet('   ')).toBe(true);
    expect(isUnassignedStreet('(Sin Asignar)')).toBe(true);
    expect(isUnassignedStreet('(sin asignar)')).toBe(true);
    expect(isUnassignedStreet('sin asignar')).toBe(true);
  });

  it('no marca calles reales', () => {
    expect(isUnassignedStreet('Gran Vía')).toBe(false);
    expect(isUnassignedStreet('Rúa do Príncipe 12')).toBe(false);
  });
});

describe('clampWindowDays', () => {
  it('acota al rango permitido y usa el default ante NaN', () => {
    expect(clampWindowDays(1)).toBe(ANALYTICS_MIN_DAYS);
    expect(clampWindowDays(500)).toBe(ANALYTICS_MAX_DAYS);
    expect(clampWindowDays(30)).toBe(30);
    expect(clampWindowDays(Number.NaN)).toBe(ANALYTICS_DEFAULT_DAYS);
  });
});

describe('pctOccupied', () => {
  it('calcula el porcentaje redondeado y devuelve 0 sin reportes', () => {
    expect(pctOccupied(1, 3)).toBe(75);
    expect(pctOccupied(0, 0)).toBe(0);
    expect(pctOccupied(5, 0)).toBe(0);
  });
});

describe('buildHourlyBuckets', () => {
  it('devuelve siempre 24 buckets rellenando con ceros', () => {
    const buckets = buildHourlyBuckets([{ hour: 9, free: 2, occupied: 3 }]);
    expect(buckets).toHaveLength(24);
    expect(buckets[0]).toEqual({ hour: 0, free: 0, occupied: 0 });
    expect(buckets[9]).toEqual({ hour: 9, free: 2, occupied: 3 });
    expect(buckets[23]).toEqual({ hour: 23, free: 0, occupied: 0 });
  });

  it('con 0 reportes devuelve 24 buckets a cero (estado vacío)', () => {
    const buckets = buildHourlyBuckets([]);
    expect(buckets).toHaveLength(24);
    expect(buckets.every((b) => b.free === 0 && b.occupied === 0)).toBe(true);
  });
});

describe('buildWeekdayBuckets', () => {
  it('mapea ISODOW (1=lunes … 7=domingo) a índices 0-6 con etiqueta', () => {
    const buckets = buildWeekdayBuckets([
      { dow: 1, free: 4, occupied: 1 },
      { dow: 7, free: 0, occupied: 6 },
    ]);
    expect(buckets).toHaveLength(7);
    expect(buckets[0]).toEqual({ day: 0, label: 'Lun', free: 4, occupied: 1 });
    expect(buckets[6]).toEqual({ day: 6, label: 'Dom', free: 0, occupied: 6 });
    expect(buckets[3].label).toBe('Jue');
  });
});

describe('buildDailyTrend', () => {
  // Miércoles 05-08-2026, mediodía UTC (14:00 en Vigo, CEST)
  const now = new Date('2026-08-05T12:00:00Z');

  it('rellena la ventana completa terminando hoy, con ceros en días sin datos', () => {
    const trend = buildDailyTrend(
      [{ day: '2026-08-04', free: 3, occupied: 1 }],
      7,
      now,
    );
    expect(trend).toHaveLength(7);
    expect(trend[0].date).toBe('2026-07-30');
    expect(trend[5]).toEqual({ date: '2026-08-04', free: 3, occupied: 1, total: 4 });
    expect(trend[6]).toEqual({ date: '2026-08-05', free: 0, occupied: 0, total: 0 });
  });

  it('con 0 reportes devuelve la ventana entera a cero (estado vacío)', () => {
    const trend = buildDailyTrend([], 30, now);
    expect(trend).toHaveLength(30);
    expect(trend.every((d) => d.total === 0)).toBe(true);
    expect(trend[29].date).toBe('2026-08-05');
  });

  it('respeta la zona horaria de Vigo al generar las claves de día', () => {
    // 23:30 UTC del 04-08 = 01:30 del 05-08 en Vigo (CEST)
    const lateNight = new Date('2026-08-04T23:30:00Z');
    const trend = buildDailyTrend([], 2, lateNight);
    expect(trend[1].date).toBe('2026-08-05');
  });
});

describe('buildStreetAggregates', () => {
  it('agrupa las "(Sin Asignar)" con etiqueta legible y las ordena al final', () => {
    const streets = buildStreetAggregates([
      { street: UNASSIGNED_KEY, reports: 50, free: 10, occupied: 40 },
      { street: 'Gran Vía', reports: 12, free: 6, occupied: 6 },
      { street: 'Urzaiz', reports: 30, free: 15, occupied: 15 },
    ]);
    expect(streets).toHaveLength(3);
    expect(streets[0].street).toBe('Urzaiz');
    expect(streets[1].street).toBe('Gran Vía');
    expect(streets[2]).toMatchObject({ street: UNASSIGNED_LABEL, unassigned: true, occupiedPct: 80 });
  });

  it('también normaliza filas que lleguen sin la marca interna', () => {
    const streets = buildStreetAggregates([{ street: '(Sin Asignar)', reports: 3, free: 3, occupied: 0 }]);
    expect(streets[0]).toMatchObject({ street: UNASSIGNED_LABEL, unassigned: true, occupiedPct: 0 });
  });
});

describe('buildTopSpots', () => {
  it('calcula % ocupada y etiqueta calles sin asignar', () => {
    const top = buildTopSpots([
      { id: 7, street: ' Gran Vía ', reports: 9, free: 6, occupied: 3 },
      { id: 8, street: '(Sin Asignar)', reports: 5, free: 0, occupied: 5 },
    ]);
    expect(top[0]).toEqual({ id: 7, street: 'Gran Vía', reports: 9, occupiedPct: 33 });
    expect(top[1]).toEqual({ id: 8, street: UNASSIGNED_LABEL, reports: 5, occupiedPct: 100 });
  });
});

describe('buildChannelAggregates', () => {
  it('ordena por visitas desc con desempate alfabético y recorta la fuente', () => {
    const channels = buildChannelAggregates([
      { source: 'instagram', visits: 7 },
      { source: 'cartel', visits: 12 },
      { source: 'whatsapp', visits: 7 },
    ]);
    expect(channels).toEqual([
      { source: 'cartel', visits: 12 },
      { source: 'instagram', visits: 7 },
      { source: 'whatsapp', visits: 7 },
    ]);
  });

  it('descarta fuentes nulas o vacías (metadata malformada)', () => {
    const channels = buildChannelAggregates([
      { source: null, visits: 5 },
      { source: '  ', visits: 3 },
      { source: 'telegram', visits: 2 },
    ]);
    expect(channels).toEqual([{ source: 'telegram', visits: 2 }]);
  });

  it('estado vacío: sin filas devuelve lista vacía', () => {
    expect(buildChannelAggregates([])).toEqual([]);
  });
});
