import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { prismaErrorResponse } from '@/lib/apiError';
import { getClientIp, rateLimit } from '@/lib/rateLimit';

const RegisterSchema = z.object({
  name: z.string().min(2).max(80),
  // Email normalizado (minúsculas, sin espacios) para que la unicidad y el
  // login por credentials no dependan de cómo lo escribió el usuario.
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

export async function POST(req: NextRequest) {
  // 5 registros por hora y IP. Frena tanto el spam de cuentas como el abuso
  // de fuerza bruta indirecto vía registro.
  const { success, retryAfterSec } = rateLimit(`register:${getClientIp(req)}`, 5, 60 * 60_000);
  if (!success) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Ya existe una cuenta con ese email' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { name, email, password: hashed },
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    // Carrera entre el findUnique y el create: el constraint único manda (P2002→409).
    const response = prismaErrorResponse(error);
    if (response) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese email' }, { status: response.status });
    }
    throw error;
  }
}
