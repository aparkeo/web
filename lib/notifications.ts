import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push';
import type { SpotStatus } from '@prisma/client';

/**
 * Avisos FAVORITE_FREED: cuando una plaza en favoritos queda LIBRE se crea
 * una fila en Notification (campana in-app) y se envía Web Push a los
 * dispositivos suscritos del usuario.
 *
 * Preferencias: no existe un toggle por plaza — marcar una plaza como
 * favorita activa estos avisos por defecto; el opt-in/opt-out real del push
 * es la suscripción del dispositivo (botón «Activar avisos» de la campana).
 *
 * Anti-spam: máximo un aviso FAVORITE_FREED por usuario y plaza cada
 * FAVORITE_FREED_COOLDOWN_MS. La ventana se consulta sobre las filas de
 * Notification (createdAt), así que no requiere campos ni tablas nuevas y
 * sobrevive a despliegues (a diferencia de un caché en memoria).
 */
export const FAVORITE_FREED_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 horas

/**
 * Detector de transición (función pura): solo es avisar cuando la plaza pasa
 * a FREE desde OTRO estado. FREE→FREE (reporte confirmatorio) y FREE→OCCUPIED
 * nunca avisan — es la clave anti-spam frente a reportes repetidos.
 */
export function isFreeTransition(
  previous: SpotStatus | null | undefined,
  next: SpotStatus | null | undefined,
): boolean {
  return previous !== 'FREE' && next === 'FREE';
}

export interface NotifyFavoriteFreedOptions {
  /** Autor del reporte que liberó la plaza: no se le avisa de lo que acaba de reportar. */
  excludeUserId?: string;
}

/**
 * Fan-out del aviso: crea la Notification para cada usuario con la plaza en
 * favoritos (menos exclusiones y anti-spam) y envía Web Push solo a los que
 * tienen al menos una PushSubscription activa.
 *
 * Devuelve cuántas notificaciones se crearon. Nunca lanza hacia el caller por
 * errores de push: sendPushToUser ya gestiona suscripciones caducadas
 * (404/410 → borrado) y errores de red sin propagar.
 */
export async function notifyFavoriteFreed(
  spotId: number,
  street: string,
  options: NotifyFavoriteFreedOptions = {},
): Promise<number> {
  const favorites = await prisma.favorite.findMany({
    where: { spotId },
    select: { userId: true },
  });

  const candidateIds = favorites
    .map((f) => f.userId)
    .filter((userId) => userId !== options.excludeUserId);
  if (candidateIds.length === 0) return 0;

  // Anti-spam por ventana temporal: si el usuario ya recibió un FAVORITE_FREED
  // de esta plaza dentro del cooldown, no se le vuelve a avisar aunque el
  // estado oscile FREE ↔ OCCUPIED (flapping).
  const recent = await prisma.notification.findMany({
    where: {
      type: 'FAVORITE_FREED',
      spotId,
      userId: { in: candidateIds },
      createdAt: { gte: new Date(Date.now() - FAVORITE_FREED_COOLDOWN_MS) },
    },
    select: { userId: true },
  });
  const inCooldown = new Set(recent.map((n) => n.userId));

  const targetIds = candidateIds.filter((userId) => !inCooldown.has(userId));
  if (targetIds.length === 0) return 0;

  const title = `Plaza libre en ${street}`;
  const body = 'Una de tus plazas favoritas acaba de quedar libre.';

  const result = await prisma.notification.createMany({
    data: targetIds.map((userId) => ({
      userId,
      type: 'FAVORITE_FREED' as const,
      title,
      body,
      spotId,
    })),
  });

  // Web Push: solo a usuarios con al menos una suscripción activa (una sola
  // consulta para filtrar, en lugar de una por usuario). El tag evita
  // duplicados en la bandeja del SO si llega más de un push por la misma
  // plaza. Envuelto en try/catch: el push NUNCA rompe el flujo.
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: targetIds } },
      select: { userId: true },
    });
    const pushUserIds = [...new Set(subscriptions.map((s) => s.userId))];

    await Promise.all(
      pushUserIds.map((userId) =>
        sendPushToUser(userId, {
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
