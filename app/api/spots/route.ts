import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { distanceMeters } from '@/lib/utils';
import type { SpotDTO } from '@/types';

const QuerySchema = z.object({
  status: z.enum(['FREE', 'OCCUPIED', 'UNKNOWN']).optional(),
  search: z.string().trim().min(1).optional(),
  lat: z.coerce.number().refine(Number.isFinite).optional(),
  lon: z.coerce.number().refine(Number.isFinite).optional(),
  // Viewport del mapa: "south,west,north,east" (roadmap nº29 — carga por
  // viewport; el índice [lat, lon] del schema ya cubre este filtro).
  bbox: z.string().trim().optional(),
});

// Salvaguarda para no devolver la tabla completa si crece el dataset.
const MAX_SPOTS_PER_QUERY = 1000;
// Con bbox el recorte geográfico ya limita el resultado; se admite un poco
// más para que un viewport urbano denso (p. ej. Madrid centro) no se corte.
const MAX_SPOTS_PER_BBOX_QUERY = 1500;

/**
 * Parsea "south,west,north,east" validando rangos. España no toca el
 * antimeridiano, así que se exige west <= east (documentado en el audit).
 */
function parseBbox(raw: string): [number, number, number, number] | null {
  const parts = raw.split(',').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [south, west, north, east] = parts;
  if (south < -90 || north > 90 || south > north) return null;
  if (west < -180 || east > 180 || west > east) return null;
  return [south, west, north, east];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    status: searchParams.get('status') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    lat: searchParams.get('lat') ?? undefined,
    lon: searchParams.get('lon') ?? undefined,
    bbox: searchParams.get('bbox') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros de búsqueda inválidos' }, { status: 400 });
  }
  const { status, search, lat, lon, bbox: bboxRaw } = parsed.data;

  const bbox = bboxRaw !== undefined ? parseBbox(bboxRaw) : undefined;
  if (bboxRaw !== undefined && bbox === null) {
    return NextResponse.json({ error: 'Parámetro bbox inválido (formato: south,west,north,east)' }, { status: 400 });
  }

  const session = await auth();

  const spots = await prisma.parkingSpot.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search ? { street: { contains: search, mode: 'insensitive' } } : {}),
      ...(bbox ? { lat: { gte: bbox[0], lte: bbox[2] }, lon: { gte: bbox[1], lte: bbox[3] } } : {}),
    },
    include: session?.user
      ? { favorites: { where: { userId: session.user.id }, select: { id: true } } }
      : undefined,
    orderBy: { street: 'asc' },
    take: bbox ? MAX_SPOTS_PER_BBOX_QUERY : MAX_SPOTS_PER_QUERY,
  });

  const dto: SpotDTO[] = spots.map((s) => ({
    id: s.id,
    city: s.city,
    street: s.street,
    lat: s.lat,
    lon: s.lon,
    spaces: s.spaces,
    status: s.status,
    confidence: s.confidence,
    source: s.source ?? null,
    lastReportAt: s.lastReportAt?.toISOString() ?? null,
    distanceM: lat !== undefined && lon !== undefined ? distanceMeters(lat, lon, s.lat, s.lon) : undefined,
    isFavorite: session?.user ? ((s as unknown as { favorites: unknown[] }).favorites?.length ?? 0) > 0 : false,
  }));

  if (lat !== undefined && lon !== undefined) {
    dto.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  }

  return NextResponse.json(dto);
}
