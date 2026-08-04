import { expect, test } from '@playwright/test';

// Smoke tests: solo lectura, seguros contra cualquier entorno.
test.describe('smoke', () => {
  test('la home carga y muestra el buscador de destino', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '¿Dónde aparco?' })).toBeVisible();
    await expect(page.getByPlaceholder(/¿A dónde vas\?/)).toBeVisible();
  });

  test('/login renderiza el formulario de acceso', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });
});
