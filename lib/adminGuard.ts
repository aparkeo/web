import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/** Devuelve la sesión si el usuario es ADMIN, o una respuesta 401/403 lista para `return`. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { ok: false as const, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  }
  if (session.user.role !== 'ADMIN') {
    return { ok: false as const, response: NextResponse.json({ error: 'Solo administradores' }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

/** True si el rol puede moderar contenido de comunidad (ocultar fotos/comentarios). */
export function isModeratorRole(role: string | undefined): boolean {
  return role === 'MODERATOR' || role === 'ADMIN';
}
