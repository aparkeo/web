import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * E2E de autenticación (next-auth v5, Credentials + JWT):
 *  - Login con email en MAYÚSCULAS/espacios (normalización trim+lowercase).
 *  - Login con contraseña incorrecta → error limpio, sin sesión.
 *  - La sesión (cookie JWT) persiste tras recargar la página.
 *  - Logout cierra la sesión.
 *
 * ⚠️ ESCRIBE EN LA BASE DE DATOS CONFIGURADA EN `.env` (Supabase compartida).
 * Mitigaciones:
 *  - UN SOLO usuario de test por run, creado directamente vía Prisma en
 *    beforeAll (no pasa por /api/register → no consume el rate limit 5/hora).
 *    El flujo de registro UI ya se cubre en report-consensus.spec.ts.
 *  - Email único `e2e+<timestamp>@test.minusvigo.local`.
 *  - Limpieza TOTAL en afterAll, incluso si los tests fallan.
 *
 * Requiere DATABASE_URL en el entorno (se carga de `.env` vía playwright.config).
 * Sin ella el spec se salta entero con test.skip.
 */

const hasDatabase = Boolean(process.env.DATABASE_URL);
const prisma = hasDatabase ? new PrismaClient() : (null as unknown as PrismaClient);

const timestamp = Date.now();
const TEST_EMAIL = `e2e+${timestamp}@test.minusvigo.local`;
const TEST_PASSWORD = `e2e-pass-${timestamp}`;
const TEST_NAME = 'E2E Auth User';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function getSessionEmail(page: Page): Promise<string | null> {
  const res = await page.request.get('/api/auth/session');
  if (!res.ok()) return null;
  const session = await res.json();
  return session?.user?.email ?? null;
}

test.describe('autenticación', () => {
  test.skip(!hasDatabase, 'DATABASE_URL no disponible: se saltan los E2E que escriben en la BD');

  test.beforeAll(async () => {
    await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: TEST_NAME,
        password: await bcrypt.hash(TEST_PASSWORD, 10),
      },
    });
  });

  test.afterAll(async () => {
    // LIMPIEZA OBLIGATORIA: borrar todo rastro del test en la BD compartida.
    await prisma.user.deleteMany({ where: { email: { endsWith: '@test.minusvigo.local' } } });
    await prisma.$disconnect();
  });

  test('login con email en MAYÚSCULAS y espacios funciona (normalización)', async ({ page }) => {
    await login(page, `  ${TEST_EMAIL.toUpperCase()}  `, TEST_PASSWORD);
    await page.waitForURL('/', { timeout: 20_000 });
    // La sesión queda con el email normalizado (lowercase), como en la BD.
    expect(await getSessionEmail(page)).toBe(TEST_EMAIL);
  });

  test('login con contraseña incorrecta falla limpio y sin sesión', async ({ page }) => {
    await login(page, TEST_EMAIL, 'contraseña-equivocada');
    // Error visible para el usuario, seguimos en /login y no hay sesión.
    await expect(page.locator('#login-error')).toHaveText('Email o contraseña incorrectos');
    await expect(page).toHaveURL(/\/login$/);
    expect(await getSessionEmail(page)).toBeNull();
  });

  test('la sesión (cookie JWT) persiste tras recargar la página', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL('/', { timeout: 20_000 });
    expect(await getSessionEmail(page)).toBe(TEST_EMAIL);

    await page.reload();
    // Tras recargar, la cookie JWT mantiene la sesión sin volver a hacer login.
    expect(await getSessionEmail(page)).toBe(TEST_EMAIL);
  });

  test('logout cierra la sesión', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL('/', { timeout: 20_000 });
    expect(await getSessionEmail(page)).toBe(TEST_EMAIL);

    // Logout vía UI: menú de usuario del navbar → "Cerrar sesión".
    await page.getByRole('button', { name: new RegExp(TEST_NAME) }).click();
    const logoutItem = page.getByRole('menuitem', { name: 'Cerrar sesión' });
    await expect(logoutItem).toBeVisible();
    await logoutItem.click();

    // El navbar vuelve al estado anónimo y la sesión queda cerrada.
    await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => getSessionEmail(page), { timeout: 15_000 }).toBeNull();
  });
});
