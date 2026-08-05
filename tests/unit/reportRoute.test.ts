import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

// --- Mocks (hoisted) -------------------------------------------------------

const spotFindUnique = vi.hoisted(() => vi.fn());
const userFindUnique = vi.hoisted(() => vi.fn());
const reportFindFirst = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const eventCreate = vi.hoisted(() => vi.fn());
const recalculateSpotStatus = vi.hoisted(() => vi.fn());
const notifyFavoriteFreed = vi.hoisted(() => vi.fn());
const afterMock = vi.hoisted(() => vi.fn());

// Se mockea solo `after` de next/server (se conservan NextRequest/NextResponse):
// en los tests capturamos el callback del fan-out y lo ejecutamos a mano.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: afterMock };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    parkingSpot: { findUnique: spotFindUnique },
    user: { findUnique: userFindUnique, update: vi.fn((args) => args) },
    report: { findFirst: reportFindFirst, create: vi.fn((args) => args) },
    $transaction: transaction,
    event: { create: eventCreate },
  },
}));

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ auth: authMock }));

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn(async () => ({ success: true, remaining: 14, retryAfterSec: 60 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/prediction', () => ({ recalculateSpotStatus }));

vi.mock('@/lib/notifications', () => ({ notifyFavoriteFreed }));

import { POST } from '@/app/api/report/route';

const USER = { id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'USER' };

const COOLDOWN_MESSAGE = 'Espera antes de volver a reportar esta plaza.';

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { spotId: 7, status: 'FREE' };

describe('POST /api/report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: USER });
    spotFindUnique.mockResolvedValue({ id: 7, lat: 42.23, lon: -8.72 });
    userFindUnique.mockResolvedValue({ id: 'user-1', reputationScore: 100 });
    reportFindFirst.mockResolvedValue(null);
    transaction.mockResolvedValue([{ id: 'r1' }, {}]);
    eventCreate.mockResolvedValue({});
    recalculateSpotStatus.mockResolvedValue({ transitionedToFree: false, street: 'Calle Test' });
    notifyFavoriteFreed.mockResolvedValue(0);
  });

  it('flujo normal: crea el reporte y devuelve ok', async () => {
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, spotId: 7 });
    expect(transaction).toHaveBeenCalledOnce();
    expect(recalculateSpotStatus).toHaveBeenCalledWith(7);
    expect(eventCreate).toHaveBeenCalledOnce();
  });

  it('fast-path: un reporte propio reciente devuelve 429 sin tocar la transacción', async () => {
    reportFindFirst.mockResolvedValue({ id: 'r-prev' });
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe(COOLDOWN_MESSAGE);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('error 23P01 (exclusion constraint de cooldown) se traduce al mismo 429, no a un 500', async () => {
    // Así llega realmente desde Prisma: P2010 con meta.code = '23P01'.
    const raw = new Prisma.PrismaClientKnownRequestError(
      'Raw query failed. Code: `23P01`. Message: `ERROR: conflicting key value violates exclusion constraint "reports_cooldown_excl"`',
      { code: 'P2010', clientVersion: '5.22.0', meta: { code: '23P01' } },
    );
    transaction.mockRejectedValue(raw);
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe(COOLDOWN_MESSAGE);
  });

  it('un error genérico que menciona 23P01 solo en el mensaje también se traduce a 429', async () => {
    transaction.mockRejectedValue(new Error('database error: code 23P01 exclusion violation'));
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe(COOLDOWN_MESSAGE);
  });

  it('P2002 (constraint única) sigue traduciéndose al mismo 429', async () => {
    transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe(COOLDOWN_MESSAGE);
  });

  it('otros errores de la transacción se propagan (no se disfrazan de cooldown)', async () => {
    transaction.mockRejectedValue(new Error('connection lost'));
    await expect(POST(postReq(VALID_BODY))).rejects.toThrow('connection lost');
  });

  it('401 si no hay sesión', async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(401);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('transición a FREE: programa el fan-out con after() excluyendo al autor del reporte', async () => {
    recalculateSpotStatus.mockResolvedValue({ transitionedToFree: true, street: 'Calle Test' });

    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(200);

    // El fan-out NO va en el hot path: se delega en after() y la respuesta
    // ya se ha compuesto. Ejecutamos el callback capturado a mano.
    expect(afterMock).toHaveBeenCalledOnce();
    const fanout = afterMock.mock.calls[0][0] as () => Promise<void>;
    await fanout();
    expect(notifyFavoriteFreed).toHaveBeenCalledWith(7, 'Calle Test', { excludeUserId: 'user-1' });
  });

  it('sin transición a FREE no se programa ningún fan-out', async () => {
    recalculateSpotStatus.mockResolvedValue({ transitionedToFree: false, street: 'Calle Test' });

    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(200);
    expect(afterMock).not.toHaveBeenCalled();
    expect(notifyFavoriteFreed).not.toHaveBeenCalled();
  });

  it('un fallo del fan-out no rompe nada: el callback de after() lo captura', async () => {
    recalculateSpotStatus.mockResolvedValue({ transitionedToFree: true, street: 'Calle Test' });
    notifyFavoriteFreed.mockRejectedValue(new Error('DB caída'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(200);

    const fanout = afterMock.mock.calls[0][0] as () => Promise<void>;
    await expect(fanout()).resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });
});
