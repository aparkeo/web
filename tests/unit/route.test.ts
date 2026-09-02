import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDrivingRoute } from '@/services/route';

// «Cómo llegar» integrado: el servicio pide la ruta al proxy interno
// /api/route (que a su vez habla con OSRM) y normaliza la respuesta.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchDrivingRoute', () => {
  it('pide la ruta al proxy con origen y destino y devuelve el resultado', async () => {
    const payload = {
      path: [
        [42.24, -8.72],
        [42.241, -8.721],
      ],
      distanceM: 1450,
      durationS: 320,
    };
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(JSON.stringify(payload), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const route = await fetchDrivingRoute(
      { lat: 42.23, lon: -8.71 },
      { lat: 42.24, lon: -8.72 },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/route?');
    expect(url).toContain('fromLat=42.23');
    expect(url).toContain('fromLon=-8.71');
    expect(url).toContain('toLat=42.24');
    expect(url).toContain('toLon=-8.72');
    expect(route.distanceM).toBe(1450);
    expect(route.durationS).toBe(320);
    expect(route.path).toHaveLength(2);
  });

  it('lanza error cuando el proxy no puede calcular la ruta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"No se pudo calcular la ruta"}', { status: 502 })),
    );

    await expect(
      fetchDrivingRoute({ lat: 42.23, lon: -8.71 }, { lat: 42.24, lon: -8.72 }),
    ).rejects.toThrow('No se pudo calcular la ruta');
  });
});
