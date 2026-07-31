import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminGuard';

// Datasets exportables (whitelist cerrada: cualquier otro valor → 400).
const DATASETS = ['spots', 'reports'] as const;
type Dataset = (typeof DATASETS)[number];

// Salvaguarda de tamaño para que un export no sature memoria ni DB.
const MAX_EXPORT_ROWS = 10_000;

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    let s = String(v ?? '');
    // Formula injection: valores que empiezan por = + - @ se neutralizan con
    // un prefijo de comilla simple (Excel/Sheets los tratan como texto).
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const datasetParam = searchParams.get('dataset') ?? 'spots';
  if (!DATASETS.includes(datasetParam as Dataset)) {
    return NextResponse.json(
      { error: `Dataset inválido. Valores permitidos: ${DATASETS.join(', ')}` },
      { status: 400 },
    );
  }
  const dataset = datasetParam as Dataset;

  let csv = '';
  if (dataset === 'reports') {
    const reports = await prisma.report.findMany({
      include: { spot: { select: { street: true } } },
      orderBy: { reportedAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    });
    csv = toCsv(
      reports.map((r) => ({
        id: r.id,
        spotId: r.spotId,
        street: r.spot.street,
        status: r.status,
        weight: r.weight,
        reportedAt: r.reportedAt.toISOString(),
      })),
    );
  } else {
    const spots = await prisma.parkingSpot.findMany({ take: MAX_EXPORT_ROWS });
    csv = toCsv(
      spots.map((s) => ({
        id: s.id,
        street: s.street,
        lat: s.lat,
        lon: s.lon,
        spaces: s.spaces,
        status: s.status,
        confidence: s.confidence,
      })),
    );
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="minusvigo-${dataset}.csv"`,
    },
  });
}
