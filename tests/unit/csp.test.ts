import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, CSP_HEADER_NAME, CSP_REPORT_PATH } from '@/lib/csp';

const prod = buildContentSecurityPolicy({ isDev: false });
const dev = buildContentSecurityPolicy({ isDev: true });

describe('Content-Security-Policy (enforce)', () => {
  it('se sirve como cabecera enforce, no Report-Only', () => {
    expect(CSP_HEADER_NAME).toBe('Content-Security-Policy');
    expect(CSP_HEADER_NAME).not.toContain('Report-Only');
  });

  it('producción: directivas de endurecimiento presentes', () => {
    for (const directive of [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ]) {
      expect(prod).toContain(directive);
    }
  });

  it('producción: img-src cubre tiles CARTO, satélite Esri y fotos Supabase', () => {
    expect(prod).toContain('https://*.basemaps.cartocdn.com');
    expect(prod).toContain('https://server.arcgisonline.com');
    expect(prod).toMatch(/img-src[^;]*https:\/\/\*\.supabase\.co/);
    expect(prod).toMatch(/img-src[^;]*data:/);
    expect(prod).toMatch(/img-src[^;]*blob:/);
  });

  it('producción: connect-src cubre API propia y Supabase (REST + Realtime)', () => {
    expect(prod).toMatch(/connect-src 'self' https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co/);
  });

  it('producción: reporta violaciones al endpoint propio', () => {
    expect(prod).toContain(`report-uri ${CSP_REPORT_PATH}`);
    expect(CSP_REPORT_PATH).toBe('/api/csp-report');
  });

  it('producción: sin unsafe-eval en script-src', () => {
    expect(prod).not.toContain('unsafe-eval');
  });

  it('desarrollo: añade unsafe-eval (HMR/React Refresh) y omite upgrade-insecure-requests', () => {
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain('upgrade-insecure-requests');
    // El resto de la política es idéntica a producción salvo esas dos piezas.
    expect(dev.replace(" 'unsafe-eval'", '')).toBe(
      prod.replace('; upgrade-insecure-requests', ''),
    );
  });
});
