import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, rateLimit } from '@/lib/rateLimit';

/**
 * Receptor de reportes de violación CSP (`report-uri /api/csp-report`).
 *
 * Los navegadores envían POST con content-type `application/csp-report`
 * (algunos `application/json`) y un cuerpo `{"csp-report": {...}}` cuya forma
 * varía por navegador, así que el parse es tolerante: no se valida con zod.
 * Cada reporte se loguea truncado y además se persiste como `Event` de tipo
 * `csp_violation` (metadata JSONB) para que el endpoint /api/health y la
 * automatización de salud puedan consultar las violaciones sin hurgar en
 * los logs de Vercel.
 *
 * Privacidad: la metadata es compacta y sin PII — `blockedUri` se reduce al
 * ORIGEN (sin path ni query, que pueden llevar datos), `documentUri` se
 * reduce al path, y jamás se guarda user-agent, IP ni usuario.
 *
 * Anti-flood: un navegador con una extensión conflictiva puede mandar el
 * mismo reporte en cada carga de página; si ya existe un `csp_violation` con
 * la misma directive + blockedUri en la última hora no se inserta otro (solo
 * log). Consulta ligera por `type` + `createdAt` con filtro en memoria (el
 * dedupe acota el volumen a ~1 fila/hora/combinación).
 *
 * Anti-abuso: rate limit por IP (`csp-report:{ip}`, 60/min). El cuerpo se
 * trunca a 2 KB en el log para que un cuerpo gigante no infle la factura de
 * logging. Si la persistencia falla se loguea el error y se responde 204
 * igualmente: el navegador no reintenta y no damos señal de nada.
 */

function safeString(value: unknown, maxLen: number): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, maxLen) : null;
}

/** blocked-uri → solo el ORIGEN (http/https) o el esquema (data:, blob:...). */
function originOnly(uri: string | null): string | null {
  if (!uri) return null;
  try {
    const url = new URL(uri);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin;
    return url.protocol; // data:, blob:, chrome-extension:... → solo el esquema
  } catch {
    // Valores especiales de los navegadores: 'inline', 'eval', 'self'...
    return uri.slice(0, 100);
  }
}

/** document-uri → solo el path (sin query ni hash, que pueden llevar datos). */
function pathOnly(uri: string | null): string | null {
  if (!uri) return null;
  try {
    return new URL(uri).pathname;
  } catch {
    return uri.split('?')[0].split('#')[0].slice(0, 200);
  }
}

interface CspViolationMetadata {
  directive: string | null;
  blockedUri: string | null;
  documentUri: string | null;
  disposition: string | null;
  [key: string]: string | null; // compatible con Prisma.InputJsonValue
}

function extractMetadata(raw: string): CspViolationMetadata | null {
  try {
    const body = JSON.parse(raw) as { 'csp-report'?: Record<string, unknown> };
    const report = body?.['csp-report'];
    if (!report || typeof report !== 'object') return null;
    const metadata: CspViolationMetadata = {
      directive:
        safeString(report['effective-directive'], 100) ??
        safeString(report['violated-directive'], 100),
      blockedUri: originOnly(safeString(report['blocked-uri'], 2000)),
      documentUri: pathOnly(safeString(report['document-uri'], 2000)),
      disposition: safeString(report['disposition'], 20),
    };
    // Sin directiva ni URI bloqueada no hay nada útil que persistir.
    if (!metadata.directive && !metadata.blockedUri) return null;
    return metadata;
  } catch {
    return null;
  }
}

async function persistViolation(metadata: CspViolationMetadata): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 3_600_000);
  const recent = await prisma.event.findMany({
    where: { type: 'csp_violation', createdAt: { gte: oneHourAgo } },
    select: { metadata: true },
  });
  const isDuplicate = recent.some((event) => {
    const m = event.metadata as { directive?: string; blockedUri?: string } | null;
    return m?.directive === metadata.directive && m?.blockedUri === metadata.blockedUri;
  });
  if (isDuplicate) return;

  await prisma.event.create({
    data: { type: 'csp_violation', metadata },
  });
}

export async function POST(req: NextRequest) {
  const { success } = await rateLimit(`csp-report:${getClientIp(req)}`, 60, 60_000);
  if (!success) {
    // 204 igualmente: el navegador no reintenta y no damos señal de nada.
    return new NextResponse(null, { status: 204 });
  }

  const raw = await req.text().catch(() => '');
  const truncated = raw.slice(0, 2048);
  console.warn('[csp-report] Violación CSP:', truncated);

  const metadata = extractMetadata(raw);
  if (metadata) {
    try {
      await persistViolation(metadata);
    } catch (error) {
      // La persistencia nunca rompe la respuesta al navegador.
      console.error('[csp-report] No se pudo persistir la violación CSP:', error);
    }
  }

  return new NextResponse(null, { status: 204 });
}
