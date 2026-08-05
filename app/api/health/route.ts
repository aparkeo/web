import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Endpoint de salud para la automatización de vigilancia (`GET /api/health`).
 *
 * Devuelve un resumen JSON del estado de la app: conectividad con la base de
 * datos, violaciones CSP de las últimas 24 h (las persiste /api/csp-report),
 * actividad de reportes y total de plazas.
 *
 * Protegido con `Authorization: Bearer $CRON_SECRET`, exactamente el mismo
 * patrón que el cron existente (app/api/cron/recompute-predictions).
 *
 * Nunca devuelve 500 por falta de datos: si la base de datos falla responde
 * 200 con `{ ok: false, dbOk: false }` y el vigilante interpreta el payload.
 * `Cache-Control: no-store` para que el chequeo siempre sea en vivo.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const noStore = { 'Cache-Control': 'no-store' };
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    const dayAgo = new Date(Date.now() - 86_400_000);
    const [cspViolations24h, violationEvents, reports24h, spotsTotal] = await Promise.all([
      prisma.event.count({ where: { type: 'csp_violation', createdAt: { gte: dayAgo } } }),
      prisma.event.findMany({
        where: { type: 'csp_violation', createdAt: { gte: dayAgo } },
        select: { metadata: true },
      }),
      prisma.report.count({ where: { reportedAt: { gte: dayAgo } } }),
      prisma.parkingSpot.count(),
    ]);

    // Agregado en memoria por directive+blockedUri (volumen bajo: el dedupe
    // anti-flood de /api/csp-report acota a ~1 fila/hora/combinación).
    const buckets = new Map<string, { directive: string | null; blockedUri: string | null; count: number }>();
    for (const event of violationEvents) {
      const m = (event.metadata ?? {}) as { directive?: string; blockedUri?: string };
      const key = `${m.directive ?? ''}|${m.blockedUri ?? ''}`;
      const bucket =
        buckets.get(key) ?? { directive: m.directive ?? null, blockedUri: m.blockedUri ?? null, count: 0 };
      bucket.count += 1;
      buckets.set(key, bucket);
    }
    const recentViolations = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    return NextResponse.json(
      { ok: true, timestamp, dbOk: true, cspViolations24h, recentViolations, reports24h, spotsTotal },
      { headers: noStore },
    );
  } catch (error) {
    console.error('[health] Fallo comprobando la salud de la app:', error);
    return NextResponse.json(
      { ok: false, timestamp, dbOk: false },
      { headers: noStore },
    );
  }
}
