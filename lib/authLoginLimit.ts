import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/rateLimit';

/**
 * Tope de intentos de login por IP. bcrypt ~100 ms/intento, así que sin
 * límite un atacante puede probar miles de contraseñas por hora y por
 * instancia. 10 / 15 min frena fuerza bruta y deja margen al usuario
 * que se equivoca (y a los E2E de auth, que hacen unos pocos logins).
 */
export const LOGIN_RATE_LIMIT = 10;
export const LOGIN_RATE_WINDOW_MS = 15 * 60_000;

/**
 * NextAuth v5 (Credentials) autentica con POST a
 * `/api/auth/callback/credentials` (y, en algunas versiones,
 * `/api/auth/signin/credentials`). El resto de rutas de Auth.js
 * (csrf, session, providers) no se limitan: no hacen bcrypt.
 */
export function isCredentialsLoginPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path.endsWith('/callback/credentials') || path.endsWith('/signin/credentials');
}

/**
 * Si el POST es un intento de login y la IP ya agotó la ventana,
 * devuelve 429 + Retry-After. Si no aplica o queda cupo, `null`
 * y el caller sigue con `handlers.POST`.
 *
 * Vive en el route handler (no en `authorize()`): ahí sí hay Request
 * y por tanto IP fiable vía `x-forwarded-for`.
 */
export async function rejectThrottledCredentialsLogin(
  req: NextRequest,
): Promise<NextResponse | null> {
  if (!isCredentialsLoginPath(new URL(req.url).pathname)) return null;

  const { success, retryAfterSec } = await rateLimit(
    `login:${getClientIp(req)}`,
    LOGIN_RATE_LIMIT,
    LOGIN_RATE_WINDOW_MS,
  );
  if (success) return null;

  return NextResponse.json(
    { error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  );
}
