import { expect, test, type Page } from '@playwright/test';

/**
 * Guardia de tiles del mapa (regresión 02-09-2026):
 *  1) CARTO pasó a exigir API key y sus tiles devolvían el watermark
 *     "API KEY REQUIRED" con HTTP 200 — el mapa se veía gris.
 *  2) El service worker interceptaba los tiles y las peticiones a OSM
 *     fallaban: el mapa se veía un momento (caché HTTP) y desaparecía
 *     al arrastrarlo (las peticiones nuevas pasaban por el SW).
 *
 * Este spec verifica lo único que importa: que los <img> de los tiles
 * cargan de verdad (complete + naturalWidth > 0), que vienen de hosts
 * permitidos (OSM / Esri), que ninguna petición de tile falla y que
 * siguen cargando tras arrastrar el mapa — en tema claro y en oscuro.
 */

// Hosts de tiles permitidos. Cualquier otro host (p. ej. un proveedor que
// exija key) hace fallar el test en cuanto la app intente cargarlo.
const ALLOWED_TILE_HOSTS = /(^|\.)tile\.openstreetmap\.org$|(^|\.)arcgisonline\.com$/;

function countLoadedTiles(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      Array.from(document.querySelectorAll<HTMLImageElement>('.leaflet-tile')).filter(
        (t) => t.complete && t.naturalWidth > 0,
      ).length,
  );
}

async function waitForTilesLoaded(page: Page): Promise<void> {
  await page.waitForSelector('.leaflet-tile', { timeout: 15_000 });
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll<HTMLImageElement>('.leaflet-tile')).some(
        (t) => t.complete && t.naturalWidth > 0,
      ),
    { timeout: 20_000 },
  );
}

// Registra las peticiones de tiles que fallen (error de red, 4xx/5xx, o la
// respuesta rota del SW). Devuelve un array que el test rellena y audita.
function trackTileRequests(page: Page): { failures: string[]; hosts: string[] } {
  const failures: string[] = [];
  const hosts: string[] = [];
  page.on('request', (req) => {
    try {
      const { host } = new URL(req.url());
      if (host.includes('openstreetmap') || host.includes('arcgisonline') || host.includes('cartocdn')) {
        if (!hosts.includes(host)) hosts.push(host);
      }
    } catch {
      // URL no parseable: ignorar.
    }
  });
  page.on('requestfailed', (req) => {
    if (/openstreetmap|arcgisonline|cartocdn/.test(req.url())) {
      failures.push(`${req.url()} -> ${req.failure()?.errorText ?? 'desconocido'}`);
    }
  });
  page.on('response', (res) => {
    if (/openstreetmap|arcgisonline|cartocdn/.test(res.url()) && res.status() >= 400) {
      failures.push(`${res.url()} -> HTTP ${res.status()}`);
    }
  });
  return { failures, hosts };
}

test.describe('tiles del mapa', () => {
  test('los tiles cargan, vienen de hosts permitidos y ninguna petición falla', async ({
    page,
  }) => {
    const { failures, hosts } = trackTileRequests(page);

    await page.goto('/map', { waitUntil: 'networkidle' });
    await waitForTilesLoaded(page);

    expect(await countLoadedTiles(page)).toBeGreaterThan(0);
    expect(hosts.length, 'no se pidió ningún tile de mapa').toBeGreaterThan(0);
    for (const host of hosts) {
      expect(host, `host de tiles no permitido: ${host}`).toMatch(ALLOWED_TILE_HOSTS);
    }
    expect(failures, `peticiones de tiles fallidas:\n${failures.join('\n')}`).toEqual([]);
  });

  test('los tiles siguen cargando tras arrastrar el mapa (regresión SW)', async ({ page }) => {
    const { failures } = trackTileRequests(page);

    await page.goto('/map', { waitUntil: 'networkidle' });
    await waitForTilesLoaded(page);

    const box = await page.locator('.leaflet-container').boundingBox();
    test.skip(!box, 'no se encontró el contenedor del mapa');
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // Arrastre real con el ratón: fuerza la petición de tiles nuevos.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(cx + i * 25, cy + i * 12);
      await page.waitForTimeout(40);
    }
    await page.mouse.up();

    // Tras el pan, Leaflet pide tiles nuevos: deben seguir cargando.
    await page.waitForTimeout(2500);
    expect(
      await countLoadedTiles(page),
      'tras arrastrar el mapa no quedó ningún tile cargado',
    ).toBeGreaterThan(0);
    expect(failures, `peticiones de tiles fallidas:\n${failures.join('\n')}`).toEqual([]);
  });

  test('en modo oscuro se aplica el filtro y los tiles cargan igual', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('theme', 'dark');
      } catch {
        // localStorage no disponible: el tema queda por defecto.
      }
    });

    await page.goto('/map', { waitUntil: 'networkidle' });
    await waitForTilesLoaded(page);

    await expect(page.locator('.leaflet-layer.map-tiles-dark')).toBeAttached({
      timeout: 10_000,
    });
    expect(await countLoadedTiles(page)).toBeGreaterThan(0);
  });
});
