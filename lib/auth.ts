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

        // TODO: rate limit por IP contra fuerza bruta en login. authorize() no
        // recibe la Request, así que no hay IP fiable aquí; la vía es mover el
        // signIn a un route handler propio o usar un wrapper con headers().
        // Mientras tanto, el rate limit de /api/register cubre el vector de
        // creación masiva de cuentas (lib/rateLimit.ts).
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
      },
    }),
  ],
});
