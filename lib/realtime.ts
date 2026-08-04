/**
 * Cliente Supabase para Realtime (feed en tiempo real, roadmap nº14).
 *
 * Solo navegador y solo publishable key: `postgres_changes` necesita
 * autenticación anónima como máximo (las tablas no tienen RLS; las
 * escrituras siguen pasando exclusivamente por las API routes con Prisma,
 * Realtime solo escucha el WAL). La SUPABASE_SECRET_KEY jamás se importa
 * aquí.
 *
 * Singleton perezoso: se crea la primera vez que un hook lo pide y solo si
 * `typeof window !== 'undefined'` (en SSR devuelve null y los hooks no
 * hacen nada). Si faltan las envs o el websocket no conecta, la app sigue
 * funcionando igual: los hooks degradan a no-op con un warn en consola.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseRealtime(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.warn(
      '[realtime] Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; feed en directo desactivado.',
    );
    return null;
  }

  client = createClient(url, key, {
    auth: {
      // No hay sesión de Supabase en el navegador: la auth de la app es
      // NextAuth. persistSession=false evita escribir tokens en localStorage.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });
  return client;
}
