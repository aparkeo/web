import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/rateLimit';

/**
 * Receptor de reportes de violación CSP (`report-uri /api/csp-report`).
 *
 * Los navegadores envían POST con content-type `application/csp-report`
 * (algunos `application/json`) y un cuerpo `{"csp-report": {...}}` cuya forma
 * varía por navegador, así que el parse es tolerante: no se valida con zod,
 * solo se loguea truncado para revisión en Vercel logs. No se persiste nada
 * en base de datos (volumen impredecible y valor analítico bajo).
 *
 * Anti-abuso: rate limit por IP (`csp-report:{ip}`, 60/min) — un navegador
 * legítimo manda a lo sumo un puñado de reportes por página; el límite frena
 * spam de logs sin afectar a usuarios reales. El cuerpo se trunca a 2 KB en
 * el log para que un cuerpo gigante no infle la factura de logging.
 */
export async function POST(req: NextRequest) {
  const { success } = await rateLimit(`csp-report:${getClientIp(req)}`, 60, 60_000);
  if (!success) {
    // 204 igualmente: el navegador no reintenta y no damos señal de nada.
    return new NextResponse(null, { status: 204 });
  }

  const raw = await req.text().catch(() => '');
  const truncated = raw.slice(0, 2048);
  console.warn('[csp-report] Violación CSP:', truncated);

  return new NextResponse(null, { status: 204 });
}
