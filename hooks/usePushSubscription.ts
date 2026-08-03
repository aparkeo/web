'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Gestiona la suscripción Web Push del dispositivo actual.
 *
 * - supported: el navegador soporta SW + PushManager + Notification y hay
 *   clave VAPID pública configurada (NEXT_PUBLIC_VAPID_PUBLIC_KEY).
 * - subscribed: el dispositivo tiene una suscripción activa en el SW.
 * - loading: hay una operación de subscribe/unsubscribe en curso.
 * - permission: estado del permiso de notificaciones del SO.
 *
 * subscribe() pide el permiso, suscribe vía PushManager y registra el
 * endpoint en el servidor; unsubscribe() hace el camino inverso.
 */

export interface UsePushSubscriptionResult {
  supported: boolean;
  subscribed: boolean;
  loading: boolean;
  permission: NotificationPermission | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// Convierte la clave VAPID pública (base64url) al ArrayBuffer que exige
// PushManager.subscribe({ applicationServerKey }).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription(): UsePushSubscriptionResult {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  // Detección inicial: soporte del navegador y suscripción ya existente.
  useEffect(() => {
    const isSupported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      Boolean(VAPID_PUBLIC_KEY);

    setSupported(isSupported);
    if (!isSupported) return;

    setPermission(Notification.permission);

    let cancelled = false;
    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setSubscribed(subscription !== null);
        }
      } catch (err) {
        console.error('[usePushSubscription] No se pudo comprobar la suscripción:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported || !VAPID_PUBLIC_KEY) return false;
    setLoading(true);
    try {
      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);
      if (requestedPermission !== 'granted') return false;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        console.error('[usePushSubscription] Suscripción incompleta:', json);
        return false;
      }

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      });
      if (!response.ok) {
        console.error('[usePushSubscription] Error registrando la suscripción:', response.status);
        return false;
      }

      setSubscribed(true);
      return true;
    } catch (err) {
      console.error('[usePushSubscription] Error al suscribirse:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Avisamos al servidor (sin importar el resultado) y luego nos damos
        // de baja en el navegador.
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch((err) =>
          console.error('[usePushSubscription] Error avisando al servidor:', err),
        );
        await subscription.unsubscribe();
      }

      setSubscribed(false);
      return true;
    } catch (err) {
      console.error('[usePushSubscription] Error al darse de baja:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, subscribed, loading, permission, subscribe, unsubscribe };
}
