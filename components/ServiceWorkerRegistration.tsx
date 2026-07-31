'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Registra /sw.js solo en producción y avisa cuando hay una versión nueva
 * esperando a activarse. No renderiza nada.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let shownUpdateToast = false;

    const notifyUpdate = () => {
      if (shownUpdateToast) return;
      shownUpdateToast = true;
      toast.info('Nueva versión disponible — recarga para actualizar', {
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
  }, []);

  return null;
}
