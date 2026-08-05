import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// Claves VAPID de mentira: ensureVapidConfigured() es perezoso, basta con que
// existan antes del primer envío (los tests no salen a la red).
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key';
process.env.VAPID_PRIVATE_KEY = 'test-private-key';

const setVapidDetails = vi.hoisted(() => vi.fn());
const sendNotification = vi.hoisted(() => vi.fn());

vi.mock('web-push', () => ({
  default: { setVapidDetails, sendNotification },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pushSubscription: { findMany: vi.fn(), delete: vi.fn() },
  },
}));

import { sendPushToUser } from '@/lib/push';
import { prisma } from '@/lib/prisma';

const subFindMany = prisma.pushSubscription.findMany as unknown as Mock;
const subDelete = prisma.pushSubscription.delete as unknown as Mock;

const SUB_1 = { id: 'sub-1', userId: 'u1', endpoint: 'https://push.example/1', p256dh: 'p1', auth: 'a1' };
const SUB_2 = { id: 'sub-2', userId: 'u1', endpoint: 'https://push.example/2', p256dh: 'p2', auth: 'a2' };

const PAYLOAD = { title: 'Plaza libre en Calle Test', body: 'Aviso', url: '/spots/7', tag: 'spot-free-7' };

beforeEach(() => {
  vi.clearAllMocks();
  sendNotification.mockResolvedValue({});
  subDelete.mockResolvedValue({});
});

describe('sendPushToUser (web-push y Prisma mockeados)', () => {
  it('envía a todas las suscripciones del usuario y cuenta los éxitos', async () => {
    subFindMany.mockResolvedValue([SUB_1, SUB_2]);

    const result = await sendPushToUser('u1', PAYLOAD);

    expect(result).toEqual({ sent: 2, expired: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: SUB_1.endpoint, keys: { p256dh: 'p1', auth: 'a1' } },
      JSON.stringify(PAYLOAD),
      { TTL: 3600 },
    );
  });

  it('sin suscripciones no envía nada', async () => {
    subFindMany.mockResolvedValue([]);

    const result = await sendPushToUser('u1', PAYLOAD);

    expect(result).toEqual({ sent: 0, expired: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('suscripción caducada (410 Gone) se borra de la DB', async () => {
    subFindMany.mockResolvedValue([SUB_1, SUB_2]);
    sendNotification.mockRejectedValueOnce({ statusCode: 410 });

    const result = await sendPushToUser('u1', PAYLOAD);

    expect(result).toEqual({ sent: 1, expired: 1 });
    expect(subDelete).toHaveBeenCalledWith({ where: { id: 'sub-1' } });
  });

  it('suscripción no encontrada (404) también se borra', async () => {
    subFindMany.mockResolvedValue([SUB_1]);
    sendNotification.mockRejectedValue({ statusCode: 404 });

    const result = await sendPushToUser('u1', PAYLOAD);

    expect(result).toEqual({ sent: 0, expired: 1 });
    expect(subDelete).toHaveBeenCalledWith({ where: { id: 'sub-1' } });
  });

  it('otros errores de envío NO borran la suscripción ni se propagan', async () => {
    subFindMany.mockResolvedValue([SUB_1]);
    sendNotification.mockRejectedValue({ statusCode: 500 });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await sendPushToUser('u1', PAYLOAD);

    expect(result).toEqual({ sent: 0, expired: 0 });
    expect(subDelete).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('un fallo al borrar la suscripción caducada no rompe el envío al resto', async () => {
    subFindMany.mockResolvedValue([SUB_1, SUB_2]);
    sendNotification.mockRejectedValueOnce({ statusCode: 410 });
    subDelete.mockRejectedValue(new Error('DB caída'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await sendPushToUser('u1', PAYLOAD);

    expect(result.sent).toBe(1);
    consoleSpy.mockRestore();
  });
});
