import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks (hoisted) -------------------------------------------------------

const userFindUnique = vi.hoisted(() => vi.fn());
const userCount = vi.hoisted(() => vi.fn());
const userDelete = vi.hoisted(() => vi.fn(async () => ({})));
const photoFindMany = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn(async () => []));

// Un deleteMany por colección: el route construye el array de la transacción
// llamándolos, así que deben devolver promesas. (Se declaran como consts
// sueltas: vi.hoisted no puede ir dentro de un objeto literal.)
const dmSpotComment = vi.hoisted(() => vi.fn(async () => ({ count: 0 })));
const dmSpotPhoto = vi.hoisted(() => vi.fn(async () => ({ count: 0 })));
const dmNotification = vi.hoisted(() => vi.fn(async () => ({ count: 0 })));
const dmFavorite = vi.hoisted(() => vi.fn(async () => ({ count: 0 })));
const dmReport = vi.hoisted(() => vi.fn(async () => ({ count: 0 })));
const dmPushSubscription = vi.hoisted(() => vi.fn(async () => ({ count: 0 })));
const dmEvent = vi.hoisted(() => vi.fn(async () => ({ count: 0 })));
const dmSession = vi.hoisted(() => vi.fn(async () => ({ count: 0 })));
const dmAccount = vi.hoisted(() => vi.fn(async () => ({ count: 0 })));

const deleteMany = {
  spotComment: dmSpotComment,
  spotPhoto: dmSpotPhoto,
  notification: dmNotification,
  favorite: dmFavorite,
  report: dmReport,
  pushSubscription: dmPushSubscription,
  event: dmEvent,
  session: dmSession,
  account: dmAccount,
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: userFindUnique, count: userCount, delete: userDelete },
    spotPhoto: { findMany: photoFindMany, deleteMany: dmSpotPhoto },
    spotComment: { deleteMany: dmSpotComment },
    notification: { deleteMany: dmNotification },
    favorite: { deleteMany: dmFavorite },
    report: { deleteMany: dmReport },
    pushSubscription: { deleteMany: dmPushSubscription },
    event: { deleteMany: dmEvent },
    session: { deleteMany: dmSession },
    account: { deleteMany: dmAccount },
    $transaction: transaction,
  },
}));

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ auth: authMock }));

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/rateLimit', () => ({
  rateLimit: rateLimitMock,
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

// Storage mockeado: los tests nunca tocan Supabase real. Registra el orden
// de llamadas para verificar bucket → DB.
const callOrder = vi.hoisted(() => [] as string[]);
const deleteStorageMock = vi.hoisted(() =>
  vi.fn(async () => {
    callOrder.push('bucket');
  }),
);
vi.mock('@/lib/supabaseStorage', () => ({ deleteSpotPhoto: deleteStorageMock }));

import { DELETE } from '@/app/api/user/route';

const USER = { id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'USER' };

describe('DELETE /api/user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    authMock.mockResolvedValue({ user: USER });
    rateLimitMock.mockResolvedValue({ success: true, remaining: 2, retryAfterSec: 3600 });
    userFindUnique.mockResolvedValue({ id: 'user-1', role: 'USER' });
    userCount.mockResolvedValue(2);
    photoFindMany.mockResolvedValue([{ storagePath: '7/user-1/a.jpg' }, { storagePath: '7/user-1/b.jpg' }]);
    transaction.mockImplementation(async () => {
      callOrder.push('db');
      return [];
    });
  });

  it('requiere autenticación (401)', async () => {
    authMock.mockResolvedValue(null);
    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(deleteStorageMock).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('aplica rate limit (429 con Retry-After)', async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, retryAfterSec: 1234 });
    const res = await DELETE();
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('1234');
    expect(rateLimitMock).toHaveBeenCalledWith('user-delete:user-1', 3, 3_600_000);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('borra las fotos del bucket ANTES de la transacción de DB', async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(deleteStorageMock).toHaveBeenCalledTimes(2);
    expect(deleteStorageMock).toHaveBeenCalledWith('7/user-1/a.jpg');
    expect(deleteStorageMock).toHaveBeenCalledWith('7/user-1/b.jpg');
    expect(callOrder).toEqual(['bucket', 'bucket', 'db']);
  });

  it('borra todas las colecciones del usuario en una transacción', async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(transaction).toHaveBeenCalledOnce();
    for (const [name, mock] of Object.entries(deleteMany)) {
      expect(mock, `deleteMany de ${name}`).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    }
    expect(userDelete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('un ADMIN que es el único administrador no puede borrar su cuenta (409)', async () => {
    userFindUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    userCount.mockResolvedValue(1);
    authMock.mockResolvedValue({ user: { ...USER, id: 'admin-1', role: 'ADMIN' } });

    const res = await DELETE();
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/único administrador/i);
    expect(deleteStorageMock).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('un ADMIN puede borrar su cuenta si hay otro administrador', async () => {
    userFindUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    userCount.mockResolvedValue(2);
    authMock.mockResolvedValue({ user: { ...USER, id: 'admin-1', role: 'ADMIN' } });

    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('si el bucket falla devuelve 502 y no toca la DB', async () => {
    deleteStorageMock.mockRejectedValueOnce(new Error('storage down'));
    const res = await DELETE();
    expect(res.status).toBe(502);
    expect(transaction).not.toHaveBeenCalled();
    expect(userDelete).not.toHaveBeenCalled();
  });

  it('si la cuenta ya no existe responde ok (idempotente)', async () => {
    userFindUnique.mockResolvedValue(null);
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(transaction).not.toHaveBeenCalled();
  });
});
