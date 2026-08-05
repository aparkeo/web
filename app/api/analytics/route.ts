import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCityAnalytics, ANALYTICS_MIN_DAYS, ANALYTICS_MAX_DAYS } from '@/lib/analytics';

const QuerySchema = z.object({
  days: z.coerce.number().int().min(ANALYTICS_MIN_DAYS).max(ANALYTICS_MAX_DAYS).optional(),
});

// Panel público de analítica de ciudad: solo agregados (sin userIds ni
// trazas individuales). Caché agresiva en CDN — los agregados no cambian
// cada segundo y el panel no necesita frescura de tiempo real.
export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({ days: req.nextUrl.searchParams.get('days') ?? undefined });
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Parámetro days no válido (entero entre ${ANALYTICS_MIN_DAYS} y ${ANALYTICS_MAX_DAYS})` },
      { status: 400 },
    );
  }

  const data = await getCityAnalytics(parsed.data.days);

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
