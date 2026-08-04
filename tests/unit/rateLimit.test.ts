import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks de los SDKs de Upstash: el módulo bajo test los importa estáticamente,
// así que se mockean para todo el archivo. En los tests del fallback en
// memoria no llegan a usarse porque las envs de Upstash están borradas.
const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  fixedWindow: vi.fn((limit: number, window: string) => ({ limit, window })),
  redisCtor: vi.fn(),
  ratelimitCtor: vi.fn(),
}));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(config: unknown) {
      mocks.redisCtor(config);
    }
  },
}));

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static fixedWindow = mocks.fixedWindow;
    constructor(config: unknown) {
      mocks.ratelimitCtor(config);
    }
    limit = mocks.limit;
  },
}));

// El estado vive a nivel de módulo (buckets, limiters, flag de log): cada test
// reimporta el módulo fresco (vi.resetModules) para no contaminarse.
async function importRateLimit() {
  return import('@/lib/rateLimit');
}

const NOW = new Date('2026-08-04T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.resetModules();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  mocks.limit.mockReset();
  mocks.fixedWindow.mockClear();
  mocks.redisCtor.mockClear();
  mocks.ratelimitCtor.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe('rateLimit en memoria (fallback sin envs de Upstash)', () => {
  it('la primera petición consume un token y abre la ventana', async () => {
    const { rateLimit } = await importRateLimit();
    const res = await rateLimit('ip:1', 5, 60_000);
    expect(res).toEqual({ success: true, remaining: 4, retryAfterSec: 60 });
  });

  it('agota el bucket tras `limit` peticiones y devuelve Retry-After', async () => {
    const { rateLimit } = await importRateLimit();
    for (let i = 0; i < 3; i++) {
      expect((await rateLimit('ip:2', 3, 60_000)).success).toBe(true);
    }
    const blocked = await rateLimit('ip:2', 3, 60_000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBe(60);
  });

  it('retryAfterSec decrece conforme avanza la ventana', async () => {
    const { rateLimit } = await importRateLimit();
    await rateLimit('ip:3', 1, 60_000);
    vi.advanceTimersByTime(45_000);
    const blocked = await rateLimit('ip:3', 1, 60_000);
    expect(blocked.success).toBe(false);
    expect(blocked.retryAfterSec).toBe(15);
  });

  it('la ventana se reinicia pasado windowMs y vuelve a dejar pasar', async () => {
    const { rateLimit } = await importRateLimit();
    await rateLimit('ip:4', 1, 60_000);
    expect((await rateLimit('ip:4', 1, 60_000)).success).toBe(false);

    vi.advanceTimersByTime(60_001);
    const res = await rateLimit('ip:4', 1, 60_000);
    expect(res.success).toBe(true);
    expect(res.remaining).toBe(0);
  });

  it('los buckets son independientes por clave', async () => {
    const { rateLimit } = await importRateLimit();
    await rateLimit('ip:a', 1, 60_000);
    expect((await rateLimit('ip:a', 1, 60_000)).success).toBe(false);
    expect((await rateLimit('ip:b', 1, 60_000)).success).toBe(true);
  });

  it('el barrido periódico elimina buckets caducados sin afectar a los vivos', async () => {
    const { rateLimit } = await importRateLimit();
    await rateLimit('ip:vieja', 1, 30_000);
    // Forzamos el barrido: SWEEP_INTERVAL_MS es 60 s desde el arranque.
    vi.advanceTimersByTime(61_000);
    await rateLimit('ip:nueva', 1, 60_000); // dispara sweep()
    // El bucket viejo caducó y fue barrido: su clave empieza ventana nueva.
    const res = await rateLimit('ip:vieja', 1, 30_000);
    expect(res.success).toBe(true);
    expect(res.retryAfterSec).toBe(30);
  });

  it('no toca Upstash y loguea el modo memoria una sola vez', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { rateLimit } = await importRateLimit();
    await rateLimit('ip:log', 5, 60_000);
    await rateLimit('ip:log', 5, 60_000);
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.ratelimitCtor).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toContain('memoria');
    info.mockRestore();
  });
});

describe('rateLimit con Upstash Redis (envs presentes)', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token-de-prueba';
  });

  it('usa fixed window con los mismos límite/ventana y mapea el resultado', async () => {
    mocks.limit.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: NOW.getTime() + 3_600_000,
    });
    const { rateLimit } = await importRateLimit();

    const res = await rateLimit('register:1.2.3.4', 5, 60 * 60_000);

    expect(mocks.redisCtor).toHaveBeenCalledWith({
      url: 'https://example.upstash.io',
      token: 'token-de-prueba',
    });
    expect(mocks.fixedWindow).toHaveBeenCalledWith(5, '3600000ms');
    expect(mocks.limit).toHaveBeenCalledWith('register:1.2.3.4');
    expect(res).toEqual({ success: true, remaining: 4, retryAfterSec: 3600 });
  });

  it('propaga el bloqueo de Upstash con Retry-After hasta el reset', async () => {
    mocks.limit.mockResolvedValue({
      success: false,
      limit: 20,
      remaining: 0,
      reset: NOW.getTime() + 42_000,
    });
    const { rateLimit } = await importRateLimit();

    const res = await rateLimit('geocode:1.2.3.4', 20, 60_000);

    expect(res).toEqual({ success: false, remaining: 0, retryAfterSec: 42 });
  });

  it('reutiliza el mismo limiter para la misma configuración y crea uno por configuración distinta', async () => {
    mocks.limit.mockResolvedValue({
      success: true,
      limit: 15,
      remaining: 14,
      reset: NOW.getTime() + 60_000,
    });
    const { rateLimit } = await importRateLimit();

    await rateLimit('report:a', 15, 60_000);
    await rateLimit('report:b', 15, 60_000);
    expect(mocks.ratelimitCtor).toHaveBeenCalledTimes(1);

    await rateLimit('register:a', 5, 60 * 60_000);
    expect(mocks.ratelimitCtor).toHaveBeenCalledTimes(2);
    // Una sola instancia de Redis compartida entre limiters.
    expect(mocks.redisCtor).toHaveBeenCalledTimes(1);
  });

  it('fail-open: si Upstash falla, cae al limitador en memoria con warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.limit.mockRejectedValue(new Error('ECONNRESET'));
    const { rateLimit } = await importRateLimit();

    // Misma forma que el token bucket: primera petición de la ventana.
    const res = await rateLimit('report:9.9.9.9', 15, 60_000);
    expect(res).toEqual({ success: true, remaining: 14, retryAfterSec: 60 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('fail-open');

    // Y el fallback en memoria sigue limitando de verdad.
    for (let i = 0; i < 14; i++) {
      await rateLimit('report:9.9.9.9', 15, 60_000);
    }
    expect((await rateLimit('report:9.9.9.9', 15, 60_000)).success).toBe(false);
    warn.mockRestore();
  });

  it('loguea el modo Upstash una sola vez por proceso', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    mocks.limit.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: NOW.getTime() + 60_000,
    });
    const { rateLimit } = await importRateLimit();
    await rateLimit('a', 5, 60_000);
    await rateLimit('b', 5, 60_000);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toContain('Upstash');
    info.mockRestore();
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
