import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

/**
 * Configuración E2E de MinusVigo Web.
 *
 * Variables de entorno:
 *  - E2E_BASE_URL   URL contra la que correr (default http://localhost:3000).
 *  - DATABASE_URL   Necesaria SOLO para el spec report-consensus: crea una
 *                   plaza ficticia de test y limpia todos sus datos al acabar.
 *                   Se carga automáticamente de `.env` (vía dotenv). Si falta,
 *                   ese spec se salta con test.skip y el resto corre igual.
 *
 * ⚠️ La base de datos configurada en `.env` es COMPARTIDA (Supabase). Los E2E
 * que escriben datos usan una plaza ficticia con id negativo y un usuario
 * `e2e+<timestamp>@test.minusvigo.local`, y borran TODO lo creado en afterAll.
 * Nunca apuntes E2E a producción con E2E_BASE_URL.
 */

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const isLocal = baseURL.includes('localhost') || baseURL.includes('127.0.0.1');

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // los tests que escriben en la BD compartida van en serie
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // En local levanta `npm run dev` automáticamente (reusa uno ya arrancado).
  // Con E2E_BASE_URL remota no hay webServer: se asume entorno ya desplegado.
  webServer: isLocal
    ? {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
