import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const eventFindMany = vi.hoisted(() => vi.fn());
const eventCreate = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());
const getClientIpMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: { event: { findMany: eventFindMany, create: eventCreate } },
}));

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: rateLimitMock,
  getClientIp: getClientIpMock,
}));

import { POST } from '@/app/api/csp-report/route';

function postReq(report: unknown): NextRequest {
  return new NextRequest('http://localhost/api/csp-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/csp-report' },
    body: typeof report === 'string' ? report : JSON.stringify({ 'csp-report': report }),
  });
}

const REPORT = {
  'violated-directive': 'script-src-elem',
  'blocked-uri': 'https://evil.example.com/track.js?token=abc123&user=42',
  'document-uri': 'https://minusvigo-web.vercel.app/map?spot=7&foo=bar#frag',
  disposition: 'enforce',
};

describe('POST /api/csp-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ success: true, remaining: 59, retryAfterSec: 60 });
    getClientIpMock.mockReturnValue('127.0.0.1');
    eventFindMany.mockResolvedValue([]);
    eventCreate.mockResolvedValue({});
  });

  it('reporte nuevo: persiste Event csp_violation y responde 204 sin contenido', async () => {
    const res = await POST(postReq(REPORT));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');

    expect(eventCreate).toHaveBeenCalledOnce();
    const data = eventCreate.mock.calls[0][0].data;
    expect(data.type).toBe('csp_violation');
    expect(data.metadata).toEqual({
      directive: 'script-src-elem',
      blockedUri: 'https://evil.example.com',
      documentUri: '/map',
      disposition: 'enforce',
    });
  });

  it('metadata saneada: blockedUri solo origen y documentUri solo path, sin query strings', async () => {
    await POST(postReq(REPORT));
    const metadata = eventCreate.mock.calls[0][0].data.metadata;
    const json = JSON.stringify(metadata);
    expect(json).not.toContain('token=abc123');
    expect(json).not.toContain('user=42');
    expect(json).not.toContain('foo=bar');
    expect(json).not.toContain('?');
    expect(json).not.toContain('#frag');
    // Nunca user-agent ni IP.
    expect(json).not.toContain('127.0.0.1');
    expect(eventCreate.mock.calls[0][0].data).not.toHaveProperty('userId');
  });

  it('URIs no-http se reducen al esquema; valores especiales del navegador se conservan', async () => {
    await POST(postReq({ 'violated-directive': 'img-src', 'blocked-uri': 'data:image/png;base64,AAAA' }));
    expect(eventCreate.mock.calls[0][0].data.metadata.blockedUri).toBe('data:');

    eventCreate.mockClear();
    await POST(postReq({ 'violated-directive': 'script-src', 'blocked-uri': 'inline' }));
    expect(eventCreate.mock.calls[0][0].data.metadata.blockedUri).toBe('inline');
  });

  it('anti-flood: mismo directive+blockedUri en la última hora no inserta otro Event', async () => {
    eventFindMany.mockResolvedValue([
      { metadata: { directive: 'script-src-elem', blockedUri: 'https://evil.example.com' } },
    ]);
    const res = await POST(postReq(REPORT));
    expect(res.status).toBe(204);
    expect(eventCreate).not.toHaveBeenCalled();

    // La consulta anti-flood filtra por tipo y ventana de 1 hora.
    const where = eventFindMany.mock.calls[0][0].where;
    expect(where.type).toBe('csp_violation');
    expect(Date.now() - where.createdAt.gte.getTime()).toBeLessThanOrEqual(3_700_000);
  });

  it('anti-flood: mismo blockedUri pero distinta directiva SÍ inserta', async () => {
    eventFindMany.mockResolvedValue([
      { metadata: { directive: 'style-src', blockedUri: 'https://evil.example.com' } },
    ]);
    const res = await POST(postReq(REPORT));
    expect(res.status).toBe(204);
    expect(eventCreate).toHaveBeenCalledOnce();
  });

  it('body no parseable o sin nada útil: responde 204 sin insertar', async () => {
    for (const bad of ['no es json', JSON.stringify({ 'csp-report': {} }), JSON.stringify({})]) {
      const res = await POST(postReq(bad));
      expect(res.status).toBe(204);
    }
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it('fallo de la DB al persistir: responde 204 igualmente (el navegador no reintenta)', async () => {
    eventCreate.mockRejectedValue(new Error('db down'));
    const res = await POST(postReq(REPORT));
    expect(res.status).toBe(204);
  });

  it('rate limit agotado: 204 sin tocar la base de datos', async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, retryAfterSec: 30 });
    const res = await POST(postReq(REPORT));
    expect(res.status).toBe(204);
    expect(eventFindMany).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
    expect(rateLimitMock).toHaveBeenCalledWith('csp-report:127.0.0.1', 60, 60_000);
  });
});
