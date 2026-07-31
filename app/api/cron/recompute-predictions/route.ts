import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recomputeHistoricalPredictions } from '@/lib/prediction';

// Concurrencia del recálculo: cada plaza implica un findMany de reports +
// upserts por bucket; en batches para no ahogar la base de datos.
const BATCH_SIZE = 10;

/**
 * Cron nocturno (Vercel Cron, ver vercel.json): recalcula la tabla Prediction
 * de TODAS las plazas a partir de su historial de Report.
 *
 * Protegido con Authorization: Bearer $CRON_SECRET — Vercel envía ese header
 * automáticamente en las llamadas de cron cuando la variable está definida.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const startedAt = Date.now();

  const spots = await prisma.parkingSpot.findMany({ select: { id: true } });

  for (let i = 0; i < spots.length; i += BATCH_SIZE) {
    const batch = spots.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(({ id }) => recomputeHistoricalPredictions(id)));
  }

  return NextResponse.json({
    ok: true,
    spots: spots.length,
    durationMs: Date.now() - startedAt,
  });
}
