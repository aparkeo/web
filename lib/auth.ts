import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  // strategy + maxAge aquí (además de auth.config.ts): este objeto sustituye
  // al de la config base tras el spread, y perdería el maxAge si no se repite.
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  providers: [
    Credentials({
      name: 'Email y contraseña',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        // Normalizado igual que en el registro (trim + lowercase) para que el
        // login no dependa de mayúsculas/espacios.
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // Rate limit por IP: app/api/auth/[...nextauth]/route.ts envuelve
        // POST y corta /callback/credentials (y /signin/credentials) con
        // 429 antes de llegar aquí. authorize() no ve la Request, así que
        // la IP no se puede limitar en este callback.
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
      },
    }),
  ],
});
