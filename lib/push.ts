import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

/**
 * Envío de Web Push notifications (RFC 8030) a los dispositivos del usuario.
 *
 * Requiere variables de entorno:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY — clave pública VAPID (también la usa el cliente)
 *   VAPID_PRIVATE_KEY            — clave privada VAPID (solo servidor)
 *
 * Si falta alguna, el módulo se convierte en un no-op (con un único warning
 * en consola) para no romper el resto del flujo de notificaciones.
 *
 * Nunca lanza errores hacia el caller: los fallos de envío se registran con
 * console.error y las suscripciones expiradas (404/410) se borran de la DB.
 */

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let vapidConfigured = false;
let vapidWarned = false;

// Init perezoso: solo se configura web-push la primera vez que se envía,
// y solo si ambas claves existen.
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    if (!vapidWarned) {
      console.warn(
        '[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY no definidas; ' +
          'los envíos Web Push están desactivados.',
      );
      vapidWarned = true;
    }
    return false;
  }

  webpush.setVapidDetails('mailto:hola@aparkeo.com', publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/**
 * Envía una notificación push a todas las suscripciones del usuario.
 * Devuelve { sent, expired }: envíos con éxito y suscripciones expiradas
 * que se han eliminado de la DB.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; expired: number }> {
  if (!ensureVapidConfigured()) return { sent: 0, expired: 0 };

  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) return { sent: 0, expired: 0 };

    const body = JSON.stringify(payload);
    let sent = 0;
    let expired = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
            { TTL: 3600 },
          );
          sent += 1;
        } catch (err) {
          const statusCode =
            typeof err === 'object' && err !== null && 'statusCode' in err
              ? (err as { statusCode?: number }).statusCode
              : undefined;

          // 404/410: la suscripción ya no existe en el push service → borrarla.
          if (statusCode === 404 || statusCode === 410) {
            try {
              await prisma.pushSubscription.delete({ where: { id: sub.id } });
              expired += 1;
            } catch (deleteErr) {
              console.error('[push] No se pudo borrar la suscripción expirada:', deleteErr);
            }
          } else {
            console.error('[push] Error al enviar a un endpoint:', err);
          }
        }
      }),
    );

    return { sent, expired };
  } catch (err) {
    console.error('[push] Error en sendPushToUser:', err);
    return { sent: 0, expired: 0 };
  }
}
