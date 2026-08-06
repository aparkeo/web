import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn(async () => ({ success: true, remaining: 19, retryAfterSec: 60 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

const fetchMock = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', fetchMock);

import { GET } from '@/app/api/geocode/route';

function getReq(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/geocode?q=${encodeURIComponent(query)}`);
}

function nominatimOk(results: { display_name: string; lat: string; lon: string }[] = []) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => results,
  });
}

describe('GET /api/geocode — búsqueda nacional (roadmap nº29)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    nominatimOk();
  });

  it('restringe a España con countrycodes=es', async () => {
    await GET(getReq('Gran Vía'));
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('countrycodes')).toBe('es');
  });

  it('ya no fija viewbox ni bounded (antes sesgaba a Vigo)', async () => {
    await GET(getReq('Gran Vía'));
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('viewbox')).toBeNull();
    expect(url.searchParams.get('bounded')).toBeNull();
  });

  it('devuelve resultados mapeados (label, lat, lon numéricos)', async () => {
    nominatimOk([{ display_name: 'Gran Vía, Madrid, España', lat: '40.42', lon: '-3.7' }]);
    const res = await GET(getReq('Gran Vía'));
    const body = (await res.json()) as { label: string; lat: number; lon: number }[];
    expect(body).toEqual([{ label: 'Gran Vía, Madrid, España', lat: 40.42, lon: -3.7 }]);
  });

  it('con q demasiado corta no llama a Nominatim y devuelve lista vacía', async () => {
    const res = await GET(getReq('ab'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('si Nominatim falla responde 502', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const res = await GET(getReq('Gran Vía'));
    expect(res.status).toBe(502);
  });
});
