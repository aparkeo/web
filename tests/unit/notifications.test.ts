import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import {
  FAVORITE_FREED_COOLDOWN_MS,
  isFreeTransition,
  notifyFavoriteFreed,
} from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push';

// Prisma y web-push (vía lib/push) mockeados: estos tests no tocan DB ni red.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    favorite: { findMany: vi.fn() },
    notification: { findMany: vi.fn(), createMany: vi.fn() },
    pushSubscription: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/push', () => ({
  sendPushToUser: vi.fn(),
}));

const favoriteFindMany = prisma.favorite.findMany as unknown as Mock;
const notificationFindMany = prisma.notification.findMany as unknown as Mock;
const notificationCreateMany = prisma.notification.createMany as unknown as Mock;
const pushSubFindMany = prisma.pushSubscription.findMany as unknown as Mock;
const sendPushMock = sendPushToUser as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  notificationFindMany.mockResolvedValue([]);
  notificationCreateMany.mockResolvedValue({ count: 0 });
  pushSubFindMany.mockResolvedValue([]);
  sendPushMock.mockResolvedValue({ sent: 1, expired: 0 });
});

describe('isFreeTransition (detector de transición, lógica pura)', () => {
  it('OCCUPIED → FREE dispara', () => {
    expect(isFreeTransition('OCCUPIED', 'FREE')).toBe(true);
  });

  it('UNKNOWN → FREE dispara', () => {
    expect(isFreeTransition('UNKNOWN', 'FREE')).toBe(true);
  });

  it('FREE → FREE NO dispara (reporte confirmatorio, anti-spam)', () => {
    expect(isFreeTransition('FREE', 'FREE')).toBe(false);
  });

  it('FREE → OCCUPIED NO dispara', () => {
    expect(isFreeTransition('FREE', 'OCCUPIED')).toBe(false);
  });

  it('OCCUPIED → UNKNOWN NO dispara', () => {
    expect(isFreeTransition('OCCUPIED', 'UNKNOWN')).toBe(false);
  });
});

describe('notifyFavoriteFreed (fan-out con Prisma y push mockeados)', () => {
  it('crea Notification para cada favorito y envía push solo a usuarios con suscripción', async () => {
    favoriteFindMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }]);
    notificationCreateMany.mockResolvedValue({ count: 3 });
    // Solo u2 y u3 tienen suscripción; u1 no → no recibe push.
    pushSubFindMany.mockResolvedValue([{ userId: 'u2' }, { userId: 'u3' }, { userId: 'u3' }]);

    const count = await notifyFavoriteFreed(7, 'Calle Test');

    expect(count).toBe(3);
    expect(notificationCreateMany).toHaveBeenCalledWith({
      data: [
        { userId: 'u1', type: 'FAVORITE_FREED', title: 'Plaza libre en Calle Test', body: 'Una de tus plazas favoritas acaba de quedar libre.', spotId: 7 },
        { userId: 'u2', type: 'FAVORITE_FREED', title: 'Plaza libre en Calle Test', body: 'Una de tus plazas favoritas acaba de quedar libre.', spotId: 7 },
        { userId: 'u3', type: 'FAVORITE_FREED', title: 'Plaza libre en Calle Test', body: 'Una de tus plazas favoritas acaba de quedar libre.', spotId: 7 },
      ],
    });
    // Push: solo u2 y u3 (deduplicado aunque tengan varias suscripciones).
    expect(sendPushMock).toHaveBeenCalledTimes(2);
    expect(sendPushMock).toHaveBeenCalledWith('u2', {
      title: 'Plaza libre en Calle Test',
      body: 'Una de tus plazas favoritas acaba de quedar libre.',
      url: '/spots/7',
      tag: 'spot-free-7',
    });
    expect(sendPushMock).toHaveBeenCalledWith('u3', expect.objectContaining({ url: '/spots/7' }));
    expect(sendPushMock).not.toHaveBeenCalledWith('u1', expect.anything());
  });

  it('excluye al autor del reporte que liberó la plaza', async () => {
    favoriteFindMany.mockResolvedValue([{ userId: 'autor' }, { userId: 'u2' }]);
    notificationCreateMany.mockResolvedValue({ count: 1 });
    pushSubFindMany.mockResolvedValue([{ userId: 'u2' }]);

    const count = await notifyFavoriteFreed(7, 'Calle Test', { excludeUserId: 'autor' });

    expect(count).toBe(1);
    const data = notificationCreateMany.mock.calls[0][0].data as { userId: string }[];
    expect(data.map((d) => d.userId)).toEqual(['u2']);
    expect(sendPushMock).toHaveBeenCalledTimes(1);
    expect(sendPushMock).toHaveBeenCalledWith('u2', expect.anything());
  });

  it('si el único favorito es el autor, no se crea ni envía nada', async () => {
    favoriteFindMany.mockResolvedValue([{ userId: 'autor' }]);

    const count = await notifyFavoriteFreed(7, 'Calle Test', { excludeUserId: 'autor' });

    expect(count).toBe(0);
    expect(notificationCreateMany).not.toHaveBeenCalled();
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it('anti-spam: un segundo aviso dentro de la ventana de 2 h no se crea ni se envía', async () => {
    favoriteFindMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    // u1 ya recibió un FAVORITE_FREED de esta plaza hace menos de 2 h.
    notificationFindMany.mockResolvedValue([{ userId: 'u1' }]);
    notificationCreateMany.mockResolvedValue({ count: 1 });
    // El mock respeta el filtro de la query: solo devuelve suscripciones de
    // los userIds que el fan-out consulta (los que no están en cooldown).
    pushSubFindMany.mockImplementation(({ where }: { where: { userId: { in: string[] } } }) =>
      Promise.resolve(
        [{ userId: 'u1' }, { userId: 'u2' }].filter((s) => where.userId.in.includes(s.userId)),
      ),
    );

    const count = await notifyFavoriteFreed(7, 'Calle Test');

    expect(count).toBe(1);
    const data = notificationCreateMany.mock.calls[0][0].data as { userId: string }[];
    expect(data.map((d) => d.userId)).toEqual(['u2']);
    // La consulta anti-spam usa la ventana temporal sobre createdAt.
    const where = notificationFindMany.mock.calls[0][0].where;
    expect(where.type).toBe('FAVORITE_FREED');
    expect(where.spotId).toBe(7);
    expect(Date.now() - where.createdAt.gte.getTime()).toBeLessThanOrEqual(FAVORITE_FREED_COOLDOWN_MS + 1000);
    // Push solo a u2 (u1 está en cooldown aunque tenga suscripción).
    expect(sendPushMock).toHaveBeenCalledTimes(1);
    expect(sendPushMock).toHaveBeenCalledWith('u2', expect.anything());
  });

  it('si todos están en cooldown, no se crea nada ni se consultan suscripciones', async () => {
    favoriteFindMany.mockResolvedValue([{ userId: 'u1' }]);
    notificationFindMany.mockResolvedValue([{ userId: 'u1' }]);

    const count = await notifyFavoriteFreed(7, 'Calle Test');

    expect(count).toBe(0);
    expect(notificationCreateMany).not.toHaveBeenCalled();
    expect(pushSubFindMany).not.toHaveBeenCalled();
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it('sin favoritos no hace nada', async () => {
    favoriteFindMany.mockResolvedValue([]);

    const count = await notifyFavoriteFreed(7, 'Calle Test');

    expect(count).toBe(0);
    expect(notificationFindMany).not.toHaveBeenCalled();
    expect(notificationCreateMany).not.toHaveBeenCalled();
  });

  it('un fallo de push no rompe el fan-out ni impide crear las Notifications', async () => {
    favoriteFindMany.mockResolvedValue([{ userId: 'u1' }]);
    notificationCreateMany.mockResolvedValue({ count: 1 });
    pushSubFindMany.mockResolvedValue([{ userId: 'u1' }]);
    sendPushMock.mockRejectedValue(new Error('push service caído'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(notifyFavoriteFreed(7, 'Calle Test')).resolves.toBe(1);
    expect(notificationCreateMany).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });
});
