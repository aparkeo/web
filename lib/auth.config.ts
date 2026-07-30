import type { NextAuthConfig } from 'next-auth';

/**
 * Config "edge-safe": sin Credentials provider (usa bcrypt, API de Node no
 * disponible en Edge Runtime) ni adapter de Prisma. middleware.ts importa
 * SOLO este archivo para no arrastrar bcryptjs al bundle de Edge. La config
 * completa (con el provider real) vive en lib/auth.ts.
 */
export const authConfig: NextAuthConfig = {
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? 'USER';
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
