import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push';

/**
 * Crea notificaciones FAVORITE_FREED para todos los usuarios que tienen la
 * plaza en favoritos.
 *
 * Anti-spam: no crea una nueva si el usuario ya tiene una FAVORITE_FREED sin
 * leer para esa misma plaza (evita bombardeo cuando el estado oscila
 * FREE ↔ OCCUPIED en poco tiempo). Una vez leída, la siguiente transición a
 * FREE vuelve a notificar.
 *
 * Devuelve cuántas notificaciones se crearon. No hay constraint único que
 * cubra (userId, spotId, type, read), así que la deduplicación se hace en
 * dos consultas: favoritos + no leídas existentes, y createMany del resto.
 */
export async function notifyFavoriteFreed(spotId: number, street: string): Promise<number> {
  const favorites = await prisma.favorite.findMany({
    where: { spotId },
    select: { userId: true },
  });
  if (favorites.length === 0) return 0;

  const pending = await prisma.notification.findMany({
    where: {
      type: 'FAVORITE_FREED',
      spotId,
      read: false,
      userId: { in: favorites.map((f) => f.userId) },
    },
    select: { userId: true },
  });
  const alreadyNotified = new Set(pending.map((n) => n.userId));

  const data = favorites
    .filter((f) => !alreadyNotified.has(f.userId))
    .map((f) => ({
      userId: f.userId,
      type: 'FAVORITE_FREED' as const,
      title: `Plaza libre en ${street}`,
      body: `La plaza PMR de ${street} que sigues acaba de quedar libre.`,
      spotId,
    }));
  if (data.length === 0) return 0;

  const result = await prisma.notification.createMany({ data });

  // Web Push: avisamos también fuera de la app a los dispositivos suscritos.
  // El tag evita duplicados en la bandeja del SO si llega más de un push
  // por la misma plaza. Envuelto en try/catch: el push NUNCA rompe el flujo.
  try {
    const title = `Plaza libre en ${street}`;
    const body = `La plaza PMR de ${street} que sigues acaba de quedar libre.`;
    await Promise.all(
      data.map((n) =>
        sendPushToUser(n.userId, {
          title,
          body,
          url: `/spots/${spotId}`,
          tag: `spot-free-${spotId}`,
        }),
      ),
    );
  } catch (err) {
    console.error('[notifications] Error enviando Web Push:', err);
  }

  return result.count;
}
