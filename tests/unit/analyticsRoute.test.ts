import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const spotCount = vi.hoisted(() => vi.fn());
const reportCount = vi.hoisted(() => vi.fn());
const reportGroupBy = vi.hoisted(() => vi.fn());
const queryRaw = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    parkingSpot: { count: spotCount },
    report: { count: reportCount, groupBy: reportGroupBy },
    $queryRaw: queryRaw,
  },
}));

import { GET } from '@/app/api/analytics/route';

function req(url = ''): NextRequest {
  return new NextRequest(`http://localhost/api/analytics${url}`);
}

describe('GET /api/analytics', () => {
  beforeEach(() => {
    spotCount.mockReset();
    reportCount.mockReset();
    reportGroupBy.mockReset();
    queryRaw.mockReset();

    spotCount.mockResolvedValue(100);
    reportCount.mockResolvedValue(0);
    reportGroupBy.mockResolvedValue([]);
    queryRaw.mockResolvedValue([]);
  });

  it('devuelve agregados con caché de CDN y sin datos personales', async () => {
    reportCount.mockResolvedValue(42);
    reportGroupBy.mockResolvedValue([{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }]);
    queryRaw
      .mockResolvedValueOnce([{ street: 'Gran Vía', reports: 8, free: 3, occupied: 5 }]) // streets
      .mockResolvedValueOnce([{ hour: 10, free: 3, occupied: 5 }]) // hourly
      .mockResolvedValueOnce([{ dow: 3, free: 3, occupied: 5 }]) // weekday
      .mockResolvedValueOnce([{ day: '2026-08-04', free: 3, occupied: 5 }]) // daily
      .mockResolvedValueOnce([{ id: 1, street: 'Gran Vía', reports: 8, free: 3, occupied: 5 }]) // top
      .mockResolvedValueOnce([
        { source: 'cartel', visits: 12 },
        { source: 'instagram', visits: 7 },
      ]); // canales UTM

    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=300');
    expect(res.headers.get('Cache-Control')).toContain('stale-while-revalidate');

    const body = await res.json();
    expect(body.windowDays).toBe(30);
    expect(body.kpis).toMatchObject({
      totalSpots: 100,
      totalReports: 42,
      reporters: 3, // solo el número de personas, nunca los ids
    });
    expect(body.hourly).toHaveLength(24);
    expect(body.hourly[10]).toEqual({ hour: 10, free: 3, occupied: 5 });
    expect(body.weekdays).toHaveLength(7);
    expect(body.weekdays[2]).toMatchObject({ label: 'Mié', free: 3, occupied: 5 });
    expect(body.daily).toHaveLength(30);
    expect(body.streets[0]).toMatchObject({ street: 'Gran Vía', reports: 8, occupiedPct: 63 });
    expect(body.topSpots[0]).toMatchObject({ id: 1, occupiedPct: 63 });
    expect(body.channels).toEqual([
      { source: 'cartel', visits: 12 },
      { source: 'instagram', visits: 7 },
    ]);
    expect(body.trackedVisits).toBe(19);
    expect(body.hasData).toBe(true);

    // La respuesta no debe contener ningún userId
    expect(JSON.stringify(body)).not.toContain('userId');
  });

  it('estado vacío: con 0 reportes devuelve buckets a cero y hasData=false', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.hasData).toBe(false);
    expect(body.kpis.totalReports).toBe(0);
    expect(body.kpis.reporters).toBe(0);
    expect(body.hourly).toHaveLength(24);
    expect(body.hourly.every((b: { free: number; occupied: number }) => b.free + b.occupied === 0)).toBe(true);
    expect(body.weekdays).toHaveLength(7);
    expect(body.daily).toHaveLength(30);
    expect(body.daily.every((d: { total: number }) => d.total === 0)).toBe(true);
    expect(body.streets).toEqual([]);
    expect(body.topSpots).toEqual([]);
    expect(body.channels).toEqual([]);
    expect(body.trackedVisits).toBe(0);
  });

  it('valida el parámetro days (zod): 400 si no es un entero en rango', async () => {
    for (const bad of ['?days=abc', '?days=2', '?days=365']) {
      const res = await GET(req(bad));
      expect(res.status).toBe(400);
    }
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('acepta una ventana personalizada válida', async () => {
    const res = await GET(req('?days=14'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.windowDays).toBe(14);
    expect(body.daily).toHaveLength(14);
  });

  it('la agregación pesada va a la DB con $queryRaw (no carga reports a memoria)', async () => {
    await GET(req());
    // 6 consultas agregadas: streets, hourly, weekday, daily, top spots, canales UTM
    expect(queryRaw).toHaveBeenCalledTimes(6);
    const sql = String(queryRaw.mock.calls[0][0].values !== undefined ? queryRaw.mock.calls[0][0] : '');
    expect(sql).toContain('GROUP BY');
  });

  it('la agregación de canales agrupa por metadata->>\'source\' sobre events en la ventana', async () => {
    await GET(req());
    const channelCall = queryRaw.mock.calls[5][0];
    const sql = Array.isArray(channelCall?.strings)
      ? channelCall.strings.join('?')
      : String(channelCall);
    expect(sql).toContain("metadata->>'source'");
    expect(sql).toContain('utm_visit');
    expect(sql).toContain('GROUP BY');
  });
});
