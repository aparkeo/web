import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// El token bucket guarda estado en un Map a nivel de módulo: cada test
// reimporta el módulo fresco (vi.resetModules) para no contaminarse.
async function importRateLimit() {
  return import('@/lib/rateLimit');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('rateLimit (token bucket en memoria)', () => {
  it('la primera petición consume un token y abre la ventana', async () => {
    const { rateLimit } = await importRateLimit();
    const res = rateLimit('ip:1', 5, 60_000);
    expect(res).toEqual({ success: true, remaining: 4, retryAfterSec: 60 });
  });

  it('agota el bucket tras `limit` peticiones y devuelve Retry-After', async () => {
    const { rateLimit } = await importRateLimit();
    for (let i = 0; i < 3; i++) {
      expect(rateLimit('ip:2', 3, 60_000).success).toBe(true);
    }
    const blocked = rateLimit('ip:2', 3, 60_000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBe(60);
  });

  it('retryAfterSec decrece conforme avanza la ventana', async () => {
    const { rateLimit } = await importRateLimit();
    rateLimit('ip:3', 1, 60_000);
    vi.advanceTimersByTime(45_000);
    const blocked = rateLimit('ip:3', 1, 60_000);
    expect(blocked.success).toBe(false);
    expect(blocked.retryAfterSec).toBe(15);
  });

  it('la ventana se reinicia pasado windowMs y vuelve a dejar pasar', async () => {
    const { rateLimit } = await importRateLimit();
    rateLimit('ip:4', 1, 60_000);
    expect(rateLimit('ip:4', 1, 60_000).success).toBe(false);

    vi.advanceTimersByTime(60_001);
    const res = rateLimit('ip:4', 1, 60_000);
    expect(res.success).toBe(true);
    expect(res.remaining).toBe(0);
  });

  it('los buckets son independientes por clave', async () => {
    const { rateLimit } = await importRateLimit();
    rateLimit('ip:a', 1, 60_000);
    expect(rateLimit('ip:a', 1, 60_000).success).toBe(false);
    expect(rateLimit('ip:b', 1, 60_000).success).toBe(true);
  });

  it('el barrido periódico elimina buckets caducados sin afectar a los vivos', async () => {
    const { rateLimit } = await importRateLimit();
    rateLimit('ip:vieja', 1, 30_000);
    // Forzamos el barrido: SWEEP_INTERVAL_MS es 60 s desde el arranque.
    vi.advanceTimersByTime(61_000);
    rateLimit('ip:nueva', 1, 60_000); // dispara sweep()
    // El bucket viejo caducó y fue barrido: su clave empieza ventana nueva.
    const res = rateLimit('ip:vieja', 1, 30_000);
    expect(res.success).toBe(true);
    expect(res.retryAfterSec).toBe(30);
  });
});

describe('getClientIp', () => {
  it('usa la primera IP de x-forwarded-for (proxy/Vercel)', async () => {
    const { getClientIp } = await importRateLimit();
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': ' 1.2.3.4 , 5.6.7.8' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('cae a x-real-ip si no hay x-forwarded-for', async () => {
    const { getClientIp } = await importRateLimit();
    const req = new Request('http://localhost', { headers: { 'x-real-ip': '9.9.9.9' } });
    expect(getClientIp(req)).toBe('9.9.9.9');
  });

  it('devuelve "unknown" sin cabeceras de proxy', async () => {
    const { getClientIp } = await importRateLimit();
    expect(getClientIp(new Request('http://localhost'))).toBe('unknown');
  });
});
