'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useT } from '@/components/i18n/I18nProvider';

/**
 * Registra /sw.js solo en producción y avisa cuando hay una versión nueva
 * esperando a activarse. No renderiza nada.
 */
export function ServiceWorkerRegistration() {
  const t = useT();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let shownUpdateToast = false;

    const notifyUpdate = () => {
      if (shownUpdateToast) return;
      shownUpdateToast = true;
      toast.info(t.common.swUpdateAvailable, {
        duration: Infinity,
      });
    };

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');

        // SW nuevo encontrado: cuando termine de instalarse y haya un SW
        // activo previo, es una actualización (no la primera instalación).
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdate();
            }
          });
        });

        // Ya hay un SW en espera al cargar la página.
        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyUpdate();
        }
      } catch (err) {
        console.warn('[SW] Error al registrar el service worker:', err);
      }
    };

    register();
  }, [t]);

  return null;
}
