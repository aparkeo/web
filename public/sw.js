/* ==========================================================================
 * MinusVigo — Service Worker (sin librerías)
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
const VERSION = '1';
const CACHE_NAME = `minusvigo-v${VERSION}`;

// App shell mínimo precacheado en install.
const APP_SHELL = ['/', '/map', '/manifest.webmanifest', '/icon.svg'];

// Host de tiles del mapa y límite de entradas (expulsión FIFO simple).
const TILE_HOST = 'basemaps.cartocdn.com';
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
        const tileKeys = keys.filter((req) => new URL(req.url).host === TILE_HOST);
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
 * fetch: enrutado por tipo de recurso. Nunca lanzar excepciones aquí.
 * ------------------------------------------------------------------------ */
self.addEventListener('fetch', (event) => {
  try {
    const { request } = event;

    // Solo GET; el resto (POST, auth, mutaciones) pasa directo a red.
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // b. Tiles del mapa (único origen externo permitido).
    if (url.host === TILE_HOST) {
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
