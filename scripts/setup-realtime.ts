/**
 * Setup de Supabase Realtime para el feed en tiempo real (roadmap nº14).
 *
 * Se ejecuta con:  npx tsx scripts/setup-realtime.ts
 *
 * Aunque todas las escrituras se hacen con Prisma desde las API routes,
 * Supabase Realtime `postgres_changes` escucha el WAL de Postgres, así que
 * funciona con cualquier escritura; solo hace falta:
 *
 *  1. Añadir las tablas a la publicación `supabase_realtime`:
 *       parking_spots  (cambios de estado de plazas → mapa/detalle)
 *       spot_photos    (fotos nuevas/eliminadas en el detalle)
 *       spot_comments  (comentarios nuevos/eliminados en el detalle)
 *
 *  2. Poner REPLICA IDENTITY FULL en esas tres tablas, para que los eventos
 *     UPDATE/DELETE incluyan la fila completa (`old`), no solo la PK.
 *
 * Nombres de tabla: los reales de Postgres (los @@map del schema.prisma),
 * no los nombres de modelo Prisma.
 *
 * Es idempotente: consulta pg_publication_tables antes de ALTER PUBLICATION
 * y REPLICA IDENTITY FULL es una operación idempotente de por sí.
 */
import { prisma } from '../lib/prisma';

const TABLES = ['parking_spots', 'spot_photos', 'spot_comments'] as const;
const PUBLICATION = 'supabase_realtime';

async function main() {
  // 0) Comprobar que la publicación existe (la crea Supabase, no nosotros).
  const pub = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*)::int AS count FROM pg_publication WHERE pubname = '${PUBLICATION}'`,
  );
  if (Number(pub[0].count) === 0) {
    throw new Error(
      `La publicación '${PUBLICATION}' no existe. ¿Es una base de datos de Supabase?`,
    );
  }

  for (const table of TABLES) {
    // 1) Añadir a la publicación solo si no está ya (idempotente).
    const inPub = await prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count
         FROM pg_publication_tables
        WHERE pubname = '${PUBLICATION}'
          AND schemaname = 'public'
          AND tablename = '${table}'`,
    );
    if (Number(inPub[0].count) === 0) {
      await prisma.$executeRawUnsafe(
        `ALTER PUBLICATION ${PUBLICATION} ADD TABLE "public"."${table}"`,
      );
      console.log(`✔ ${table} añadida a la publicación ${PUBLICATION}.`);
    } else {
      console.log(`= ${table} ya estaba en la publicación ${PUBLICATION}.`);
    }

    // 2) REPLICA IDENTITY FULL (idempotente).
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "public"."${table}" REPLICA IDENTITY FULL`,
    );
    console.log(`✔ ${table} → REPLICA IDENTITY FULL.`);
  }

  // 3) Verificación final: tablas en la publicación + replica identity.
  const pubTables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename
       FROM pg_publication_tables
      WHERE pubname = '${PUBLICATION}'
      ORDER BY tablename`,
  );
  console.log(
    `ℹ Tablas en ${PUBLICATION}: ${pubTables.map((r) => r.tablename).join(', ') || '(ninguna)'}`,
  );

  const replica = await prisma.$queryRawUnsafe<{ relname: string; relreplident: string }[]>(
    `SELECT relname, relreplident
       FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname IN (${TABLES.map((t) => `'${t}'`).join(', ')})
      ORDER BY relname`,
  );
  for (const row of replica) {
    // relreplident: d = default, n = nothing, f = full, i = index
    const label = { d: 'DEFAULT', n: 'NOTHING', f: 'FULL', i: 'INDEX' }[row.relreplident] ?? row.relreplident;
    console.log(`ℹ ${row.relname}: replica identity = ${label}`);
  }
}

main()
  .catch((error) => {
    console.error('✖ Error configurando Supabase Realtime:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
