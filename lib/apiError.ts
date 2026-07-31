import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

/**
 * Mapea errores conocidos de Prisma a respuestas HTTP:
 *  - P2025 (registro no encontrado en update/delete) → 404
 *  - P2002 (violación de constraint único) → 409
 * Devuelve null si el error no es un PrismaClientKnownRequestError mapeable.
 */
export function prismaErrorResponse(error: unknown, notFoundMessage = 'Recurso no encontrado'): NextResponse | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: notFoundMessage }, { status: 404 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un registro con esos datos' }, { status: 409 });
    }
  }
  return null;
}

/**
 * Ejecuta una operación Prisma traduciendo sus errores conocidos a respuestas
 * HTTP. Relanza cualquier otro error inesperado (lo recoge Next.js como 500).
 */
export async function withPrismaErrors<T>(
  op: () => Promise<T>,
  notFoundMessage?: string,
): Promise<{ data: T; response?: never } | { data?: never; response: NextResponse }> {
  try {
    return { data: await op() };
  } catch (error) {
    const response = prismaErrorResponse(error, notFoundMessage);
    if (response) return { response };
    throw error;
  }
}
