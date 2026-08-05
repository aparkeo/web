import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getClientIp, rateLimit } from '@/lib/rateLimit';
import { UTM_VALUE_REGEX } from '@/lib/utm';

// Mismo formato conservador que el cliente (lib/utm.ts): minúsculas, dígitos,
// guion y guion bajo, 1-40 caracteres. medium/campaign son opcionales y
// anulables (el cliente manda null cuando el parámetro no venía o no era válido).
const TrackSchema = z.object({
  source: z.string().regex(UTM_VALUE_REGEX),
  medium: z.string().regex(UTM_VALUE_REGEX).nullable().optional(),
  campaign: z.string().regex(UTM_VALUE_REGEX).nullable().optional(),
});

/**
 * Tracking de visitas por canal UTM (QRs/enlaces de difusión).
 *
 * Privacidad por diseño (cero PII): la fila NO guarda userId aunque haya
 * sesión iniciada, ni IP, ni user-agent. La IP solo vive en memoria para el
 * rate limit (`track:{ip}`, 30/hora) y nunca toca la base de datos.
 *
 * Respuesta 204 sin contenido: el cliente no necesita saber nada.
 */
export async function POST(req: NextRequest) {
  const { success, retryAfterSec } = await rateLimit(`track:${getClientIp(req)}`, 30, 3_600_000);
  if (!success) {
    return NextResponse.json(
      { error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = TrackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos UTM inválidos' }, { status: 400 });
  }

  const { source, medium, campaign } = parsed.data;
  await prisma.event.create({
    data: {
      type: 'utm_visit',
      metadata: { source, medium: medium ?? null, campaign: campaign ?? null },
    },
  });

  return new NextResponse(null, { status: 204 });
}
