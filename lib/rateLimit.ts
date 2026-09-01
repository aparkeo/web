import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate limiting con dos backends:
 *
 * - **Upstash Redis** (producción): si `UPSTASH_REDIS_REST_URL` y
 *   `UPSTASH_REDIS_REST_TOKEN` están definidas, se usa `@upstash/ratelimit`
 *   con fixed window. Es el único modo que coordina entre instancias
 *   serverless (Vercel), así que es la garantía real en producción.
 * - **Token bucket en memoria** (fallback): si faltan las envs (dev local,
 *   previews sin configurar) se usa el limitador local best-effort de
 *   siempre. Además, si Upstash falla por red/timeout, se hace **fail-open**
 *   a este limitador: la disponibilidad manda sobre el rate limit perfecto.
 *
 * El modo activo se loguea una vez por proceso.
 */

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Segundos hasta que la ventana se reinicia (para Retry-After). */
  retryAfterSec: number;
}

// ---------------------------------------------------------------------------
// Fallback: token bucket en memoria (por clave, normalmente IP)
// ---------------------------------------------------------------------------

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

/**
 * Consume un token del bucket de `key`. Devuelve success=false cuando se
 * superan `limit` peticiones dentro de `windowMs`.
 */
function rateLimitInMemory(key: string, limit: number, windowMs: number): RateLimitResult {
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

// ---------------------------------------------------------------------------
// Backend principal: Upstash Redis (fixed window, multi-instancia)
// ---------------------------------------------------------------------------

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const upstashConfigured = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

let redis: Redis | null = null;
// Un Ratelimit por combinación (límite, ventana): register 5/hora,
// login 10/15 min, geocode 20/min, report 15/min. Se crean perezosamente
// y se reutilizan.
const limiters = new Map<string, Ratelimit>();

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    redis ??= new Redis({ url: UPSTASH_URL as string, token: UPSTASH_TOKEN as string });
    limiter = new Ratelimit({
      redis,
      // Fixed window casa con la semántica del token bucket anterior:
      // contador por ventana que se reinicia entera (mismo Retry-After).
      limiter: Ratelimit.fixedWindow(limit, `${windowMs}ms`),
      prefix: 'minusvigo:ratelimit',
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

let modeLogged = false;
function logModeOnce(): void {
  if (modeLogged) return;
  modeLogged = true;
  console.info(
    upstashConfigured
      ? '[rateLimit] Modo Upstash Redis (distribuido, multi-instancia).'
      : '[rateLimit] Envs de Upstash ausentes: modo token bucket en memoria (best-effort).',
  );
}

/**
 * Consume un intento de rate limit para `key`. Primero intenta Upstash Redis
 * (si está configurado); ante cualquier error de red/timeout hace fail-open
 * al token bucket en memoria para no tirar el servicio por culpa del
 * limitador.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  logModeOnce();

  if (!upstashConfigured) {
    return rateLimitInMemory(key, limit, windowMs);
  }

  try {
    const res = await getUpstashLimiter(limit, windowMs).limit(key);
    return {
      success: res.success,
      remaining: res.remaining,
      retryAfterSec: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    };
  } catch (error) {
    console.warn('[rateLimit] Upstash no respondió; fail-open al limitador en memoria.', error);
    return rateLimitInMemory(key, limit, windowMs);
  }
}

/** IP del cliente según el proxy (Vercel rellena x-forwarded-for). */
export function getClientIp(req: NextRequest | Request): string {
  const headers = req.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip')?.trim() ?? 'unknown';
}
