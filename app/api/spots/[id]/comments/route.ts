import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { COMMENTS_RATE_LIMIT, createCommentSchema, type SpotCommentDTO } from '@/lib/spotContent';

const PAGE_SIZE = 50;

function parseSpotId(id: string): number | null {
  const spotId = Number(id);
  return Number.isFinite(spotId) ? spotId : null;
}

/**
 * GET /api/spots/[id]/comments — últimos 50 comentarios visibles
 * (hidden=false), más recientes primero, con el nombre del autor.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const spotId = parseSpotId(id);
  if (spotId === null) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const comments = await prisma.spotComment.findMany({
    where: { spotId, hidden: false },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE,
    include: { user: { select: { name: true } } },
  });

  const dto: SpotCommentDTO[] = comments.map((c) => ({
    id: c.id,
    body: c.body,
    authorId: c.userId,
    authorName: c.user.name ?? 'Usuario',
    createdAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json(dto);
}

/**
 * POST /api/spots/[id]/comments — publica un comentario.
 * Auth requerida, rate limit 10/hora por usuario, body validado con zod
 * (trim + 1-500 chars; el render de React escapa el HTML, pero la
 * validación garantiza que nunca se persiste basura).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Inicia sesión para comentar' }, { status: 401 });
  }

  const { id } = await params;
  const spotId = parseSpotId(id);
  if (spotId === null) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const { success, retryAfterSec } = await rateLimit(
    `spot-comments:${session.user.id}`,
    COMMENTS_RATE_LIMIT.limit,
    COMMENTS_RATE_LIMIT.windowMs,
  );
  if (!success) {
    return NextResponse.json(
      { error: 'Has comentado demasiado rápido. Inténtalo de nuevo más tarde.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Comentario inválido' },
      { status: 400 },
    );
  }

  const spot = await prisma.parkingSpot.findUnique({ where: { id: spotId }, select: { id: true } });
  if (!spot) {
    return NextResponse.json({ error: 'Plaza no encontrada' }, { status: 404 });
  }

  const comment = await prisma.spotComment.create({
    data: { spotId, userId: session.user.id, body: parsed.data.body },
    include: { user: { select: { name: true } } },
  });

  const dto: SpotCommentDTO = {
    id: comment.id,
    body: comment.body,
    authorId: comment.userId,
    authorName: comment.user.name ?? 'Usuario',
    createdAt: comment.createdAt.toISOString(),
  };
  return NextResponse.json(dto, { status: 201 });
}
