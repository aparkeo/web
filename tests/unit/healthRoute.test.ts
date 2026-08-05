import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const queryRaw = vi.hoisted(() => vi.fn());
const eventCount = vi.hoisted(() => vi.fn());
const eventFindMany = vi.hoisted(() => vi.fn());
const reportCount = vi.hoisted(() => vi.fn());
const spotCount = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: queryRaw,
    event: { count: eventCount, findMany: eventFindMany },
    report: { count: reportCount },
    parkingSpot: { count: spotCount },
  },
}));

import { GET } from '@/app/api/health/route';

function getReq(authorization?: string): NextRequest {
  return new NextRequest('http://localhost/api/health', {
    method: 'GET',
    headers: authorization ? { authorization } : {},
  });
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'test-secret');
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    eventCount.mockResolvedValue(3);
    eventFindMany.mockResolvedValue([
      { metadata: { directive: 'script-src-elem', blockedUri: 'https://evil.example.com' } },
      { metadata: { directive: 'script-src-elem', blockedUri: 'https://evil.example.com' } },
      { metadata: { directive: 'img-src', blockedUri: 'data:' } },
    ]);
    reportCount.mockResolvedValue(12);
    spotCount.mockResolvedValue(843);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('401 sin Authorization', async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(401);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('401 con bearer incorrecto', async () => {
    const res = await GET(getReq('Bearer otro-secret'));
    expect(res.status).toBe(401);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('con secret válido: forma completa, ok:true y no-store', async () => {
    const res = await GET(getReq('Bearer test-secret'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.dbOk).toBe(true);
    expect(typeof json.timestamp).toBe('string');
    expect(json.cspViolations24h).toBe(3);
    expect(json.reports24h).toBe(12);
    expect(json.spotsTotal).toBe(843);

    // Agregadas por directive+blockedUri, ordenadas por count desc, máx 5.
    expect(json.recentViolations).toEqual([
      { directive: 'script-src-elem', blockedUri: 'https://evil.example.com', count: 2 },
      { directive: 'img-src', blockedUri: 'data:', count: 1 },
    ]);
  });

  it('ventana de 24 h en las consultas de eventos y reportes', async () => {
    await GET(getReq('Bearer test-secret'));
    for (const where of [eventCount.mock.calls[0][0].where, eventFindMany.mock.calls[0][0].where]) {
      expect(where.type).toBe('csp_violation');
      expect(Date.now() - where.createdAt.gte.getTime()).toBeLessThanOrEqual(86_500_000);
    }
    const reportWhere = reportCount.mock.calls[0][0].where;
    expect(Date.now() - reportWhere.reportedAt.gte.getTime()).toBeLessThanOrEqual(86_500_000);
  });

  it('base de datos caída: 200 con ok:false y dbOk:false (el vigilante interpreta)', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    const res = await GET(getReq('Bearer test-secret'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.dbOk).toBe(false);
  });

  it('sin CRON_SECRET configurado: 500 (mismo patrón que el cron)', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const res = await GET(getReq('Bearer test-secret'));
    expect(res.status).toBe(500);
  });
});
