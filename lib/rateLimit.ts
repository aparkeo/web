import type { NextRequest } from 'next/server';

/**
 * Rate limiting ligero en memoria (token bucket por clave, normalmente IP).
 *
 * NOTA: en un despliegue serverless multi-instancia (Vercel) cada instancia
 * tiene su propio Map, así que esto es best-effort — útil contra abuso casual
 * y picos, no como garantía estricta. La vía de producción es un store
 * compartido tipo Upstash Redis (@upstash/ratelimit).
 */

interface Bucket {
  tokens: number;
  expiresAt: number;
}

const buckets = new Map<string, Bucket>();

// Limpieza periódica para no acumular buckets caducados en procesos longevos.
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.expiresAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Segundos hasta que la ventana se reinicia (para Retry-After). */
  retryAfterSec: number;
}

/**
 * Consume un token del bucket de `key`. Devuelve success=false cuando se
 * superan `limit` peticiones dentro de `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    buckets.set(key, { tokens: limit - 1, expiresAt: now + windowMs });
    return { success: true, remaining: limit - 1, retryAfterSec: Math.ceil(windowMs / 1000) };
  }

  if (bucket.tokens <= 0) {
    return {
      success: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
    };
  }

  bucket.tokens -= 1;
  return { success: true, remaining: bucket.tokens, retryAfterSec: Math.ceil((bucket.expiresAt - now) / 1000) };
}

/** IP del cliente según el proxy (Vercel rellena x-forwarded-for). */
export function getClientIp(req: NextRequest | Request): string {
  const headers = req.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip')?.trim() ?? 'unknown';
}
