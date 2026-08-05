import { describe, expect, it } from 'vitest';
import {
  SPONSORS,
  SUPPORT_CONTACT_EMAIL,
  SUPPORT_KOFI_URL,
  SUPPORT_PAYPAL_URL,
  hasSponsors,
} from '@/lib/support';

describe('lib/support', () => {
  it('define las URLs de donación como placeholders https claros', () => {
    expect(SUPPORT_KOFI_URL).toMatch(/^https:\/\//);
    expect(SUPPORT_KOFI_URL).toContain('ko-fi.com');
    expect(SUPPORT_PAYPAL_URL).toMatch(/^https:\/\//);
    expect(SUPPORT_PAYPAL_URL).toContain('paypal');
  });

  it('define un email de contacto de patrocinio con forma válida', () => {
    expect(SUPPORT_CONTACT_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it('la lista de patrocinadores arranca vacía y hasSponsors() es false', () => {
    expect(SPONSORS).toEqual([]);
    expect(hasSponsors()).toBe(false);
  });

  it('hasSponsors() refleja el contenido de SPONSORS', () => {
    // Cada sponsor cumple el contrato mínimo: nombre obligatorio, url/logo opcionales.
    SPONSORS.push({ name: 'Cafetería Ejemplo', url: 'https://ejemplo.es' });
    expect(hasSponsors()).toBe(true);
    SPONSORS.pop();
    expect(hasSponsors()).toBe(false);
  });
});
