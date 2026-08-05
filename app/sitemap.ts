import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'always', priority: 1 },
    { url: `${SITE_URL}/map`, changeFrequency: 'always', priority: 0.9 },
    { url: `${SITE_URL}/analytics`, changeFrequency: 'hourly', priority: 0.7 },
    { url: `${SITE_URL}/stats`, changeFrequency: 'hourly', priority: 0.6 },
    { url: `${SITE_URL}/report`, changeFrequency: 'daily', priority: 0.5 },
    { url: `${SITE_URL}/apoyo`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/instituciones`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/login`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/register`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  // Si la base de datos no está disponible en build-time, el sitemap se
  // genera solo con las rutas estáticas en vez de tirar todo el build.
  try {
    const spots = await prisma.parkingSpot.findMany({ select: { id: true, updatedAt: true } });
    const spotRoutes: MetadataRoute.Sitemap = spots.map((s) => ({
      url: `${SITE_URL}/spots/${s.id}`,
      lastModified: s.updatedAt,
      changeFrequency: 'hourly',
      priority: 0.5,
    }));
    return [...staticRoutes, ...spotRoutes];
  } catch {
    return staticRoutes;
  }
}
