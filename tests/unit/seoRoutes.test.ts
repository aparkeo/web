import { beforeEach, describe, expect, it, vi } from 'vitest';

const spotFindMany = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({
  prisma: { parkingSpot: { findMany: spotFindMany } },
}));

import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { SITE_URL } from '@/lib/site';

describe('robots.ts', () => {
  it('permite todo salvo /admin y /api, y anuncia el sitemap', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] });
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe('sitemap.ts', () => {
  beforeEach(() => {
    spotFindMany.mockReset();
  });

  it('incluye las rutas públicas principales y el detalle de cada plaza', async () => {
    spotFindMany.mockResolvedValue([{ id: 7, updatedAt: new Date('2026-08-01T10:00:00Z') }]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(SITE_URL);
    expect(urls).toContain(`${SITE_URL}/map`);
    expect(urls).toContain(`${SITE_URL}/analytics`);
    expect(urls).toContain(`${SITE_URL}/report`);
    expect(urls).toContain(`${SITE_URL}/stats`);
    expect(urls).toContain(`${SITE_URL}/spots/7`);

    const spotEntry = entries.find((e) => e.url === `${SITE_URL}/spots/7`);
    expect(spotEntry?.lastModified).toEqual(new Date('2026-08-01T10:00:00Z'));
  });

  it('nunca expone /admin ni /api', async () => {
    spotFindMany.mockResolvedValue([{ id: 1, updatedAt: new Date() }]);
    const entries = await sitemap();
    expect(entries.some((e) => e.url.includes('/admin') || e.url.includes('/api'))).toBe(false);
  });

  it('si la base de datos falla devuelve solo las rutas estáticas', async () => {
    spotFindMany.mockRejectedValue(new Error('db down'));

    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => !e.url.includes('/spots/'))).toBe(true);
    expect(entries.map((e) => e.url)).toContain(`${SITE_URL}/map`);
  });
});

describe('lib/site', () => {
  it('usa el dominio de producción como base por defecto', () => {
    // En los tests no hay NEXT_PUBLIC_SITE_URL: debe caer al dominio de Vercel.
    expect(SITE_URL).toBe('https://minusvigo-web.vercel.app');
  });
});
