import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks (hoisted) -------------------------------------------------------

const spotFindMany = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({
  prisma: { parkingSpot: { findMany: spotFindMany } },
}));

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ auth: authMock }));

import { GET } from '@/app/api/spots/route';

function makeSpot(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    city: 'Vigo',
    street: 'Gran Vía',
    lat: 42.24,
    lon: -8.72,
    spaces: 1,
    status: 'FREE',
    confidence: 'NONE',
    source: 'vigo-opendata',
    lastReportAt: null,
    ...overrides,
  };
}

function getReq(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/spots${query}`);
}

describe('GET /api/spots — bbox por viewport (roadmap nº29)', () => {
  beforeEach(() => {
    spotFindMany.mockReset();
    spotFindMany.mockResolvedValue([makeSpot()]);
    authMock.mockReset();
    authMock.mockResolvedValue(null);
  });

  it('con bbox filtra lat/lon por rango en la query de Prisma', async () => {
    const res = await GET(getReq('?bbox=40,-10,44,-2'));
    expect(res.status).toBe(200);

    const where = spotFindMany.mock.calls[0][0].where;
    expect(where.lat).toEqual({ gte: 40, lte: 44 });
    expect(where.lon).toEqual({ gte: -10, lte: -2 });
  });

  it('con bbox aplica un límite mayor que sin bbox', async () => {
    await GET(getReq('?bbox=40,-10,44,-2'));
    expect(spotFindMany.mock.calls[0][0].take).toBe(1500);

    await GET(getReq());
    expect(spotFindMany.mock.calls[1][0].take).toBe(1000);
  });

  it('rechaza un bbox con formato inválido', async () => {
    for (const bad of ['40,-10,44', 'norte,sur,este,oeste', '44,-10,40,-2', '40,-2,44,-10']) {
      const res = await GET(getReq(`?bbox=${bad}`));
      expect(res.status, `bbox="${bad}" debe ser 400`).toBe(400);
    }
    // Ninguna de las peticiones inválidas llegó a la base de datos.
    expect(spotFindMany).not.toHaveBeenCalled();
  });

  it('sin bbox mantiene el comportamiento legado (sin filtro geográfico)', async () => {
    const res = await GET(getReq('?status=FREE'));
    expect(res.status).toBe(200);

    const where = spotFindMany.mock.calls[0][0].where;
    expect(where).toEqual({ status: 'FREE' });
    expect(where.lat).toBeUndefined();
    expect(where.lon).toBeUndefined();
  });

  it('el DTO incluye el source (necesario para la deduplicación visual)', async () => {
    const res = await GET(getReq('?bbox=40,-10,44,-2'));
    const body = (await res.json()) as { source?: string | null }[];
    expect(body[0].source).toBe('vigo-opendata');
  });

  it('mapea source null cuando el registro no lo tiene', async () => {
    spotFindMany.mockResolvedValue([makeSpot({ source: null })]);
    const res = await GET(getReq('?bbox=40,-10,44,-2'));
    const body = (await res.json()) as { source?: string | null }[];
    expect(body[0].source).toBeNull();
  });
});
