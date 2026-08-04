import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const findManySpots = vi.hoisted(() => vi.fn());
const findManyPredictions = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    parkingSpot: { findMany: findManySpots },
    prediction: { findMany: findManyPredictions },
  },
}));

vi.mock('@/lib/prediction', () => ({
  getSpotPrediction: vi.fn(async () => ({
    spotId: 1,
    probabilityFree: 0.8,
    confidenceLabel: 'Alta',
    source: 'live',
    lastUpdated: null,
    sampleSize: 10,
  })),
  rankSpotsByRecommendation: vi.fn((spots: unknown[]) => spots),
  vigoNow: vi.fn(() => ({ dayOfWeek: 2, hour: 10 })),
}));

import { GET } from '@/app/api/best-spot/route';

const SPOT = {
  id: 1,
  city: 'Vigo',
  street: 'Gran Vía',
  lat: 42.24,
  lon: -8.72,
  spaces: 2,
  status: 'FREE',
  confidence: 'CONFIRMED',
  lastReportAt: null,
};

function req(url: string): NextRequest {
  return new NextRequest(`http://localhost/api/best-spot${url}`);
}

describe('GET /api/best-spot — parámetro status', () => {
  beforeEach(() => {
    findManySpots.mockReset();
    findManyPredictions.mockReset();
    findManySpots.mockResolvedValue([SPOT]);
    findManyPredictions.mockResolvedValue([]);
  });

  it('sin status no filtra por estado en la query de DB', async () => {
    const res = await GET(req('?lat=42.24&lon=-8.72'));
    expect(res.status).toBe(200);
    const where = findManySpots.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('status');
    expect(where.lat).toBeDefined();
    expect(where.lon).toBeDefined();
  });

  it('status=FREE filtra por estado en la query de DB', async () => {
    const res = await GET(req('?lat=42.24&lon=-8.72&status=FREE'));
    expect(res.status).toBe(200);
    expect(findManySpots.mock.calls[0][0].where.status).toBe('FREE');
  });

  it('status=OCCUPIED filtra por estado en la query de DB', async () => {
    const res = await GET(req('?lat=42.24&lon=-8.72&status=OCCUPIED'));
    expect(res.status).toBe(200);
    expect(findManySpots.mock.calls[0][0].where.status).toBe('OCCUPIED');
  });

  it('status inválido devuelve 400 sin tocar la DB', async () => {
    const res = await GET(req('?lat=42.24&lon=-8.72&status=CASI_LIBRE'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/status inválido/);
    expect(findManySpots).not.toHaveBeenCalled();
  });

  it('status en minúsculas también es inválido (enum estricto)', async () => {
    const res = await GET(req('?lat=42.24&lon=-8.72&status=free'));
    expect(res.status).toBe(400);
  });

  it('sin plazas en el radio devuelve spot null aunque haya status', async () => {
    findManySpots.mockResolvedValue([]);
    const res = await GET(req('?lat=42.24&lon=-8.72&status=FREE'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.spot).toBeNull();
  });

  it('lat/lon inválidos siguen devolviendo 400', async () => {
    const res = await GET(req('?lat=abc&lon=-8.72'));
    expect(res.status).toBe(400);
  });
});
