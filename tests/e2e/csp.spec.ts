import { expect, test } from '@playwright/test';

/**
 * Guardia CSP: con la política en modo ENFORCE, un recurso bloqueado rompe la
 * página de verdad (no solo un warn en consola). Este spec carga las rutas con
 * más superficie de recursos externos (mapa con tiles, detalle con fotos de
 * Supabase, analítica con recharts) y falla si la consola registra cualquier
 * mensaje de violación CSP.
 *
 * Corre tanto contra `npm run dev` (webServer automático) como contra un build
 * de producción (`E2E_BASE_URL=http://localhost:3100 npx playwright test csp`).
 */
const CSP_ERROR = /content security policy|refused to (load|execute|connect|frame)|violat/i;

async function expectNoCspViolations(page: import('@playwright/test').Page, route: string) {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && CSP_ERROR.test(msg.text())) {
      violations.push(msg.text().slice(0, 300));
    }
  });
  page.on('pageerror', (error) => {
    if (CSP_ERROR.test(error.message)) violations.push(error.message.slice(0, 300));
  });

  await page.goto(route, { waitUntil: 'networkidle' });
  // Margen para tiles, hidratación tardía y realtime.
  await page.waitForTimeout(4000);

  expect(violations, `violaciones CSP en ${route}:\n${violations.join('\n')}`).toEqual([]);
}

test.describe('CSP enforce', () => {
  test('/map carga sin violaciones CSP (tiles OSM/Esri + Supabase)', async ({ page }) => {
    await expectNoCspViolations(page, '/map');
  });

  test('/analytics carga sin violaciones CSP (recharts)', async ({ page }) => {
    await expectNoCspViolations(page, '/analytics');
  });

  test('/spots/[id] carga sin violaciones CSP (fotos Supabase + OG)', async ({ page, request }) => {
    const res = await request.get('/api/spots');
    test.skip(!res.ok(), 'sin /api/spots disponible en este entorno');
    const spots: Array<{ id: number | string }> = await res.json();
    test.skip(spots.length === 0, 'sin plazas en la base de datos de este entorno');

    await expectNoCspViolations(page, `/spots/${spots[0].id}`);
  });
});
