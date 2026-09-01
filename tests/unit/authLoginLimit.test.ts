import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const rateLimitMock = vi.fn();

vi.mock('@/lib/rateLimit', () => ({
  getClientIp: (req: { headers: { get: (name: string) => string | null } }) => {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return 'unknown';
  },
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
}));

import {
  LOGIN_RATE_LIMIT,
  LOGIN_RATE_WINDOW_MS,
  isCredentialsLoginPath,
  rejectThrottledCredentialsLogin,
} from '@/lib/authLoginLimit';

function post(path: string, ip = '203.0.113.9'): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  });
}

beforeEach(() => {
  rateLimitMock.mockReset();
});

afterEach(() => {
  rateLimitMock.mockReset();
});

describe('isCredentialsLoginPath', () => {
  it('detecta el callback de Credentials de Auth.js v5', () => {
    expect(isCredentialsLoginPath('/api/auth/callback/credentials')).toBe(true);
    expect(isCredentialsLoginPath('/api/auth/callback/credentials/')).toBe(true);
  });

  it('detecta /signin/credentials (variante de algunas versiones)', () => {
    expect(isCredentialsLoginPath('/api/auth/signin/credentials')).toBe(true);
  });

  it('no limita csrf, session ni otros providers', () => {
    expect(isCredentialsLoginPath('/api/auth/csrf')).toBe(false);
    expect(isCredentialsLoginPath('/api/auth/session')).toBe(false);
    expect(isCredentialsLoginPath('/api/auth/callback/google')).toBe(false);
    expect(isCredentialsLoginPath('/api/register')).toBe(false);
  });
});

describe('rejectThrottledCredentialsLogin', () => {
  it('no llama al limiter si el POST no es un login por credentials', async () => {
    const res = await rejectThrottledCredentialsLogin(post('/api/auth/session'));
    expect(res).toBeNull();
    expect(rateLimitMock).not.toHaveBeenCalled();
  });

  it('deja pasar el login cuando queda cupo', async () => {
    rateLimitMock.mockResolvedValue({ success: true, remaining: 9, retryAfterSec: 900 });
    const res = await rejectThrottledCredentialsLogin(post('/api/auth/callback/credentials'));
    expect(res).toBeNull();
    expect(rateLimitMock).toHaveBeenCalledWith(
      'login:203.0.113.9',
      LOGIN_RATE_LIMIT,
      LOGIN_RATE_WINDOW_MS,
    );
  });

  it('responde 429 + Retry-After cuando la IP agota la ventana', async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, retryAfterSec: 42 });
    const res = await rejectThrottledCredentialsLogin(post('/api/auth/callback/credentials'));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get('Retry-After')).toBe('42');
    await expect(res!.json()).resolves.toEqual({
      error: 'Demasiados intentos. Inténtalo de nuevo más tarde.',
    });
  });

  it('también limita /signin/credentials', async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, retryAfterSec: 10 });
    const res = await rejectThrottledCredentialsLogin(post('/api/auth/signin/credentials'));
    expect(res?.status).toBe(429);
  });
});
