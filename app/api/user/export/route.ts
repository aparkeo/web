import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

/**
 * GET /api/user/export — exportación de datos personales (derecho de
 * portabilidad, RGPD art. 20).
 *
 * Devuelve un JSON descargable (Content-Disposition: attachment) con TODOS
 * los datos que la app guarda del usuario autenticado: perfil (NUNCA el hash
 * de la contraseña), reportes, favoritos, comentarios, fotos (URL pública),
 * notificaciones, suscripciones push y eventos propios.
 *
 * Rate limit: 5 exportaciones/hora por usuario.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const userId = session.user.id;

  const { success, retryAfterSec } = await rateLimit(`user-export:${userId}`, 5, 60 * 60_000);
  if (!success) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  const [user, reports, favorites, comments, photos, notifications, pushSubscriptions, events] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, reputationScore: true, createdAt: true },
    }),
    prisma.report.findMany({
      where: { userId },
      include: { spot: { select: { street: true } } },
      orderBy: { reportedAt: 'desc' },
    }),
    prisma.favorite.findMany({
      where: { userId },
      include: { spot: { select: { id: true, street: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.spotComment.findMany({
      where: { userId },
      include: { spot: { select: { street: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.spotPhoto.findMany({
      where: { userId },
      include: { spot: { select: { street: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.event.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  ]);

  if (!user) {
    return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    servicio: 'MinusVigo (minusvigo-web)',
    perfil: {
      id: user.id,
      nombre: user.name,
      email: user.email,
      rol: user.role,
      puntuacionDeFiabilidad: user.reputationScore,
      cuentaCreadaEl: user.createdAt.toISOString(),
    },
    reportes: reports.map((r) => ({
      id: r.id,
      plaza: { id: r.spotId, calle: r.spot.street },
      estado: r.status,
      lat: r.lat,
      lon: r.lon,
      precisionGpsMetros: r.accuracyM,
      fecha: r.reportedAt.toISOString(),
    })),
    favoritos: favorites.map((f) => ({
      plaza: { id: f.spot.id, calle: f.spot.street },
      fecha: f.createdAt.toISOString(),
    })),
    comentarios: comments.map((c) => ({
      id: c.id,
      plaza: { id: c.spotId, calle: c.spot.street },
      texto: c.body,
      ocultoPorModeracion: c.hidden,
      fecha: c.createdAt.toISOString(),
    })),
    fotos: photos.map((p) => ({
      id: p.id,
      plaza: { id: p.spotId, calle: p.spot.street },
      url: p.url,
      ocultaPorModeracion: p.hidden,
      fecha: p.createdAt.toISOString(),
    })),
    notificaciones: notifications.map((n) => ({
      id: n.id,
      tipo: n.type,
      titulo: n.title,
      cuerpo: n.body,
      leida: n.read,
      fecha: n.createdAt.toISOString(),
    })),
    suscripcionesPush: pushSubscriptions.map((s) => ({
      id: s.id,
      endpoint: s.endpoint,
      fecha: s.createdAt.toISOString(),
    })),
    eventos: events.map((e) => ({
      id: e.id,
      tipo: e.type,
      metadata: e.metadata,
      fecha: e.createdAt.toISOString(),
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="minusvigo-mis-datos.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
