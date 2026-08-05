import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const eventCreate = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());
const getClientIpMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: { event: { create: eventCreate } },
}));

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: rateLimitMock,
  getClientIp: getClientIpMock,
}));

import { POST } from '@/app/api/track/route';

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { source: 'cartel', medium: 'qr', campaign: 'lanzamiento' };

describe('POST /api/track', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ success: true, remaining: 29, retryAfterSec: 3600 });
    getClientIpMock.mockReturnValue('127.0.0.1');
    eventCreate.mockResolvedValue({});
  });

  it('visita válida: guarda evento utm_visit y responde 204 sin contenido', async () => {
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');

    expect(eventCreate).toHaveBeenCalledOnce();
    const data = eventCreate.mock.calls[0][0].data;
    expect(data.type).toBe('utm_visit');
    expect(data.metadata).toEqual({ source: 'cartel', medium: 'qr', campaign: 'lanzamiento' });
  });

  it('cero PII: no guarda userId ni IP en la fila', async () => {
    await POST(postReq(VALID_BODY));
    const data = eventCreate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('userId');
    expect(JSON.stringify(data)).not.toContain('127.0.0.1');
  });

  it('medium y campaign son opcionales y se persisten como null', async () => {
    const res = await POST(postReq({ source: 'instagram' }));
    expect(res.status).toBe(204);
    expect(eventCreate.mock.calls[0][0].data.metadata).toEqual({
      source: 'instagram',
      medium: null,
      campaign: null,
    });
  });

  it('400 ante formato inválido (zod, mismos regex que el cliente)', async () => {
    for (const bad of [
      { source: 'Cartel' }, // mayúsculas
      { source: 'con espacio' },
      { source: 'a'.repeat(41) }, // demasiado largo
      { source: '' },
      { source: '<script>' },
      { source: 'cartel', medium: 'NO VÁLIDO' },
      {}, // sin source
      null, // body no JSON
    ]) {
      const res = await POST(postReq(bad));
      expect(res.status).toBe(400);
    }
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it('429 cuando el rate limit por IP se agota (30/hora), con Retry-After', async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, retryAfterSec: 1234 });
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('1234');
    expect(eventCreate).not.toHaveBeenCalled();

    // La IP solo se usa para la clave del limiter, nunca se persiste.
    expect(rateLimitMock).toHaveBeenCalledWith('track:127.0.0.1', 30, 3_600_000);
  });
});
