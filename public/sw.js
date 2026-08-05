/* ==========================================================================
 * Aparkeo — Service Worker (sin librerías)
 *
 * Objetivo: que la app siga siendo útil SIN COBERTURA en la calle:
 *   - El app shell y las páginas visitadas cargan offline.
 *   - Las zonas del mapa ya visitadas se ven offline (tiles en caché).
 *   - /api/spots sirve el último listado guardado cuando no hay red.
 *
 * Estrategia por tipo de recurso:
 *   a. _next/static/** y fuentes/media  -> cache-first
 *   b. Tiles de cartocdn.com            -> cache-first con límite FIFO
 *   c. /api/spots                       -> network-first con fallback a caché
 *   d. Navegaciones                     -> network-first, fallback a caché y a '/'
 *   e. Resto de /api/**                 -> solo red (auth y mutaciones no se cachean)
 *
 * Solo se manejan peticiones GET y nunca se cachean respuestas no-ok.
 * Todo el código es defensivo: un fallo aquí NUNCA debe romper una request.
 * ========================================================================== */

// Cambiar esta versión fuerza la sustitución de todas las cachés en activate.
const VERSION = '3';
const CACHE_NAME = `minusvigo-v${VERSION}`;

// App shell mínimo precacheado en install.
const APP_SHELL = ['/', '/map', '/manifest.webmanifest', '/icon.svg'];

// Hosts de tiles del mapa (CARTO temático y Esri satélite) y límite de
// entradas (expulsión FIFO simple).
const TILE_HOSTS = ['basemaps.cartocdn.com', 'server.arcgisonline.com'];
const TILE_CACHE_MAX = 600;

/* --------------------------------------------------------------------------
 * install: precache del app shell y activación inmediata.
 * ------------------------------------------------------------------------ */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        // addAll es atómico; si un recurso falla, precacheamos uno a uno.
        try {
          await cache.addAll(APP_SHELL);
        } catch {
          await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
        }
      } catch (err) {
        console.warn('[SW] Error en install:', err);
      }
      await self.skipWaiting();
    })(),
  );
});

/* --------------------------------------------------------------------------
 * activate: borra cachés de versiones anteriores y toma el control.
 * ------------------------------------------------------------------------ */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name.startsWith('minusvigo-') && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        );
      } catch (err) {
        console.warn('[SW] Error en activate:', err);
      }
      await self.clients.claim();
    })(),
  );
});

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

// ¿Respuesta apta para caché? Solo 200 (u opaque, para recursos cross-origin).
function isCacheable(response) {
  return response && (response.ok || response.type === 'opaque');
}

// Guarda una respuesta en caché sin romper nunca el flujo principal.
async function safePut(request, response) {
  try {
    if (isCacheable(response)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
  } catch (err) {
    console.warn('[SW] No se pudo cachear:', request.url, err);
  }
}

// Cache-first: sirve de caché; si no está, va a red y guarda la respuesta.
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    await safePut(request, response);
    return response;
  } catch (err) {
    console.warn('[SW] cacheFirst falló:', request.url, err);
    // Último recurso: reintentar la red tal cual (respuesta de error, no excepción).
    return fetch(request);
  }
}

// Tiles: cache-first con límite de entradas; al superarlo expulsa las más
// antiguas (FIFO según orden de inserción de cache.keys()).
async function tileCacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (isCacheable(response)) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        const tileKeys = keys.filter((req) => TILE_HOSTS.includes(new URL(req.url).host));
        if (tileKeys.length > TILE_CACHE_MAX) {
          const excess = tileKeys.length - TILE_CACHE_MAX;
          await Promise.all(tileKeys.slice(0, excess).map((req) => cache.delete(req)));
        }
      } catch (err) {
        console.warn('[SW] No se pudo cachear tile:', err);
      }
    }
    return response;
  } catch (err) {
    console.warn('[SW] tileCacheFirst falló:', request.url, err);
    return fetch(request);
  }
}

// /api/spots: network-first para tener datos frescos; sin red, sirve la
// última copia guardada marcándola con X-Served-From para la UI.
async function spotsNetworkFirst(request) {
  try {
    const response = await fetch(request);
    await safePut(request, response);
    return response;
  } catch {
    try {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set('X-Served-From', 'sw-cache');
        return new Response(cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers,
        });
      }
    } catch (err) {
      console.warn('[SW] Sin caché para /api/spots:', err);
    }
    // Ni red ni caché: respuesta de error controlada.
    return new Response(JSON.stringify({ error: 'offline', spots: [] }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Navegaciones: network-first; offline sirve la página cacheada y, en última
// instancia, la portada '/' precacheada.
async function navigationNetworkFirst(request) {
  try {
    const response = await fetch(request);
    await safePut(request, response);
    return response;
  } catch {
    try {
      const cached = await caches.match(request);
      if (cached) return cached;
      const home = await caches.match('/');
      if (home) return home;
    } catch (err) {
      console.warn('[SW] Fallback de navegación falló:', err);
    }
    return Response.error();
  }
}

/* --------------------------------------------------------------------------
 * push: muestra una notificación del SO cuando el servidor envía un Web Push.
 * Payload esperado (JSON): { title, body, url?, tag? }.
 * ------------------------------------------------------------------------ */
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      // Fallback defensivo por si el payload no es JSON válido.
      let data = { title: 'Aparkeo', body: '', url: '/', tag: undefined };
      try {
        if (event.data) {
          const parsed = event.data.json();
          data = { ...data, ...parsed };
        }
      } catch (err) {
        console.warn('[SW] Payload push no válido:', err);
        try {
          const text = event.data ? event.data.text() : '';
          if (text) data = { ...data, body: text };
        } catch {
          // Sin cuerpo utilizable: se muestra la notificación por defecto.
        }
      }

      try {
        await self.registration.showNotification(data.title, {
          body: data.body,
          // El tag agrupa/reemplaza notificaciones repetidas en la bandeja del SO.
          tag: data.tag,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          data: { url: data.url },
        });
      } catch (err) {
        console.warn('[SW] No se pudo mostrar la notificación:', err);
      }
    })(),
  );
});

/* --------------------------------------------------------------------------
 * notificationclick: cierra la notificación y lleva al usuario a la URL
 * del payload, reutilizando una ventana abierta si existe.
 * ------------------------------------------------------------------------ */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      try {
        const windowClients = await clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        const client = windowClients.find((c) => 'focus' in c);
        if (client) {
          await client.focus();
          if ('navigate' in client) {
            await client.navigate(url);
          }
          return;
        }
        await clients.openWindow(url);
      } catch (err) {
        console.warn('[SW] Error en notificationclick:', err);
        // Último recurso: intentar abrir ventana sin más comprobaciones.
        try {
          await clients.openWindow(url);
        } catch {
          // Nada más que hacer.
        }
      }
    })(),
  );
});

/* --------------------------------------------------------------------------
 * fetch: enrutado por tipo de recurso. Nunca lanzar excepciones aquí.
 * ------------------------------------------------------------------------ */
self.addEventListener('fetch', (event) => {
  try {
    const { request } = event;

    // Solo GET; el resto (POST, auth, mutaciones) pasa directo a red.
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // b. Tiles del mapa (únicos orígenes externos permitidos).
    if (TILE_HOSTS.includes(url.host)) {
      event.respondWith(tileCacheFirst(request));
      return;
    }

    // Todo lo demás: solo same-origin.
    if (url.origin !== self.location.origin) return;

    // a. Assets estáticos de Next y fuentes/media.
    if (
      url.pathname.startsWith('/_next/static/') ||
      ['font', 'image', 'style', 'script'].includes(request.destination)
    ) {
      event.respondWith(cacheFirst(request));
      return;
    }

    // c. Datos de plazas (con o sin query string).
    if (url.pathname === '/api/spots') {
      event.respondWith(spotsNetworkFirst(request));
      return;
    }

    // e. Resto de la API: solo red, nunca caché.
    if (url.pathname.startsWith('/api/')) return;

    // d. Navegaciones entre páginas.
    if (request.mode === 'navigate') {
      event.respondWith(navigationNetworkFirst(request));
      return;
    }

    // Resto (iconos, manifest, etc.): cache-first.
    event.respondWith(cacheFirst(request));
  } catch (err) {
    // Defensa total: si algo inesperado falla, no interceptamos la request.
    console.warn('[SW] Error en fetch handler:', err);
  }
});
