import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

/**
 * E2E del flujo core: registrar usuario → login → reportar plaza → consenso.
 *
 * ⚠️ ESCRIBE EN LA BASE DE DATOS CONFIGURADA EN `.env` (Supabase compartida).
 * Mitigaciones:
 *  - Plaza ficticia con id NEGATIVO (los ids reales vienen del dataset oficial
 *    del Concello y son positivos) y calle marcada como TEST.
 *  - Usuario con email único `e2e+<timestamp>@test.minusvigo.local`.
 *  - Limpieza TOTAL en afterAll (reportes, eventos, usuario, plaza), incluso
 *    si el test falla.
 *
 * Requiere DATABASE_URL en el entorno (se carga de `.env` vía playwright.config).
 * Sin ella el spec se salta entero con test.skip.
 */

const TEST_SPOT_ID = -900001;
const TEST_SPOT = {
  id: TEST_SPOT_ID,
  city: 'Vigo',
  street: 'TEST E2E — Calle Ficticia (borrar si persiste)',
  lat: 42.2328,
  lon: -8.7226,
  spaces: 1,
};

const hasDatabase = Boolean(process.env.DATABASE_URL);
const prisma = hasDatabase ? new PrismaClient() : (null as unknown as PrismaClient);

let testEmail = '';
let testUserId: string | null = null;

test.describe('flujo reportar → consenso', () => {
  test.skip(!hasDatabase, 'DATABASE_URL no disponible: se saltan los E2E que escriben en la BD');

  test.beforeAll(async () => {
    // Plaza ficticia de test (upsert por si una ejecución anterior falló a medias).
    await prisma.parkingSpot.upsert({
      where: { id: TEST_SPOT_ID },
      update: { status: 'UNKNOWN', confidence: 'NONE', lastReportAt: null },
      create: TEST_SPOT,
    });
  });

  test.afterAll(async () => {
    // LIMPIEZA OBLIGATORIA: borrar todo rastro del test en la BD compartida.
    if (testUserId) {
      await prisma.report.deleteMany({ where: { userId: testUserId } });
      await prisma.event.deleteMany({ where: { userId: testUserId } });
      await prisma.notification.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    // Red de seguridad por si el test murió antes de capturar testUserId.
    await prisma.user.deleteMany({ where: { email: { endsWith: '@test.minusvigo.local' } } });
    await prisma.report.deleteMany({ where: { spotId: TEST_SPOT_ID } });
    await prisma.prediction.deleteMany({ where: { spotId: TEST_SPOT_ID } });
    await prisma.parkingSpot.deleteMany({ where: { id: TEST_SPOT_ID } });
    await prisma.$disconnect();
  });

  test('registro → login → reporte FREE → la plaza queda reflejada como libre', async ({ page }) => {
    const timestamp = Date.now();
    testEmail = `e2e+${timestamp}@test.minusvigo.local`;
    const password = `e2e-pass-${timestamp}`;

    // 1. Registro vía UI (la página hace signIn automático tras crear la cuenta).
    await page.goto('/register');
    await page.getByLabel('Nombre').fill('E2E Test User');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByLabel('Confirmar contraseña').fill(password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await page.waitForURL('/', { timeout: 20_000 });

    // 2. Sesión activa: capturamos el userId para la limpieza.
    const sessionRes = await page.request.get('/api/auth/session');
    expect(sessionRes.ok()).toBeTruthy();
    const session = await sessionRes.json();
    expect(session?.user?.email).toBe(testEmail);
    testUserId = session.user.id;

    // 3. Reportar la plaza ficticia como FREE (in situ: misma lat/lon).
    const reportRes = await page.request.post('/api/report', {
      data: { spotId: TEST_SPOT_ID, status: 'FREE', lat: TEST_SPOT.lat, lon: TEST_SPOT.lon },
    });
    expect(reportRes.status()).toBe(200);

    // 4. El consenso se refleja en la API pública de la plaza.
    await expect
      .poll(
        async () => {
          const res = await page.request.get(`/api/spots/${TEST_SPOT_ID}`);
          return res.ok() ? (await res.json()).status : null;
        },
        { timeout: 15_000 },
      )
      .toBe('FREE');
  });
});
