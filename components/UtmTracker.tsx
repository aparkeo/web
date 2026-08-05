'use client';

import { useEffect } from 'react';
import { parseUtmParams, utmSessionKey } from '@/lib/utm';

/**
 * Captura visitas llegadas por QR/enlace con UTM y las envía a /api/track.
 *
 * - Corre una sola vez por carga de página (montado en providers.tsx).
 * - Dedup por sesión de navegador: la combinación source+medium+campaign se
 *   envía como máximo una vez por pestaña/sesión (sessionStorage), así un
 *   refresco no infla el contador.
 * - Envío con `fetch(..., { keepalive: true })`: en móvil es la opción más
 *   fiable (sobrevive al cambio de página/cierre) y acepta JSON con header;
 *   sendBeacon no permite Content-Type application/json en todos los casos.
 * - Tras capturar, limpia los parámetros utm_* de la URL con
 *   history.replaceState nativo (no dispara navegación del App Router), para
 *   que la URL compartida/copiada quede limpia. El render no depende de esos
 *   parámetros, así que es seguro.
 * - Cualquier fallo (red, storage deshabilitado) es silencioso: la analítica
 *   nunca debe romper la experiencia.
 */
export function UtmTracker() {
  useEffect(() => {
    try {
      const utm = parseUtmParams(window.location.search);
      if (!utm) return;

      const key = utmSessionKey(utm);
      if (window.sessionStorage.getItem(key)) return;

      // Marcamos ANTES del envío: si la petición falla por red, no reintentar
      // en cada refresco (best-effort; un 4xx/5xx tampoco debe reintentarse).
      window.sessionStorage.setItem(key, '1');

      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: utm.source, medium: utm.medium, campaign: utm.campaign }),
        keepalive: true,
      }).catch(() => {
        // Silencioso por diseño.
      });

      const url = new URL(window.location.href);
      url.searchParams.delete('utm_source');
      url.searchParams.delete('utm_medium');
      url.searchParams.delete('utm_campaign');
      window.history.replaceState(window.history.state, '', url.toString());
    } catch {
      // sessionStorage inaccesible (modo privado estricto, etc.): no medimos.
    }
  }, []);

  return null;
}
