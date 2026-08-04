/**
 * Setup del cooldown de reportes a nivel de base de datos (roadmap nº10).
 *
 * Se ejecuta con:  npx tsx scripts/setup-report-cooldown.ts
 *
 * Semántica (la misma que el fast-path de app/api/report/route.ts):
 * un mismo usuario no puede crear dos reportes sobre la misma plaza dentro
 * de una ventana de 60 segundos. La comprobación en aplicación se queda
 * como fast-path de UX, pero esta constraint es la que garantiza la regla
 * incluso con escrituras concurrentes o externas a la API.
 *
 * En Postgres no se puede usar now() en un índice parcial (no es inmutable),
 * así que la herramienta correcta es una EXCLUSION CONSTRAINT con btree_gist:
 * dos filas chocan si coinciden en "userId" y "spotId" y sus ventanas de
 * 60 s desde "reportedAt" se solapan (tstzrange ... WITH &&).
 *
 * Detalle de tipos: `reportedAt` es `timestamp without time zone` (el
 * mapeo por defecto de Prisma DateTime). Por eso la función trabaja con
 * `timestamp`/`tsrange` (no timestamptz/tstzrange): `timestamp + interval`
 * sí es IMMUTABLE. Aun así la función es plpgsql IMMUTABLE a propósito:
 * las funciones SQL se inlinan y Postgres volvería a evaluar la expresión
 * interna (error 42P17 si cualquier pieza no es IMMUTABLE).
 *
 * Es idempotente: consulta pg_constraint antes del ALTER TABLE y captura el
 * error de «constraint ya existe» (SQLSTATE 42710) por si acaso. Antes de
 * crearla comprueba que no haya datos que la violarían; si los hubiera,
 * lo reporta y NO falla silenciosamente.
 *
 * Nombres de tabla/columnas: los reales de Postgres (@@map del schema:
 * tabla `reports`, columnas camelCase "userId"/"spotId"/"reportedAt").
 */
import { prisma } from '../lib/prisma';

const TABLE = 'reports';
const CONSTRAINT = 'reports_cooldown_excl';
const FUNCTION = 'reports_cooldown_range';
const COOLDOWN = "interval '60 seconds'";

async function main() {
  // 1) Extensión btree_gist (requerida por EXCLUDE con = sobre texto/int).
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS btree_gist');
  console.log('✔ Extensión btree_gist presente.');

  // 2) Función IMMUTABLE que construye la ventana de cooldown. La columna
  //    reportedAt es `timestamp without time zone`, así que se usa tsrange
  //    (`timestamp + interval` es IMMUTABLE, a diferencia de timestamptz).
  //    plpgsql (no SQL) para que no se inline la expresión interna.
  //    CREATE OR REPLACE es idempotente. Se elimina antes la variante con
  //    firma timestamptz (de iteraciones anteriores del setup), si existiera.
  await prisma.$executeRawUnsafe(
    `DROP FUNCTION IF EXISTS "${FUNCTION}"(timestamptz)`,
  );
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION "${FUNCTION}"(ts timestamp)
    RETURNS tsrange
    LANGUAGE plpgsql
    IMMUTABLE
    PARALLEL SAFE
    AS $fn$
    BEGIN
      RETURN tsrange(ts, ts + ${COOLDOWN});
    END;
    $fn$
  `);
  console.log(`✔ Función ${FUNCTION}() creada/actualizada (IMMUTABLE).`);

  // 2) ¿Ya existe la constraint?
  const existing = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*)::int AS count
       FROM pg_constraint
      WHERE conname = '${CONSTRAINT}'
        AND conrelid = 'public.${TABLE}'::regclass`,
  );
  if (Number(existing[0].count) > 0) {
    console.log(`= La constraint ${CONSTRAINT} ya existía en ${TABLE}. Nada que hacer.`);
    return;
  }

  // 3) Datos que la violarían: pares del mismo usuario+plaza con menos de
  //    60 s entre sus reportedAt. No debería haber ninguno (el fast-path de
  //    la API lo impide), pero si los hubiera hay que saberlo, no fallar
  //    silenciosamente.
  const conflicts = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*)::int AS count
       FROM "${TABLE}" a
       JOIN "${TABLE}" b
         ON a."userId" = b."userId"
        AND a."spotId" = b."spotId"
        AND a.id < b.id
        AND "${FUNCTION}"(a."reportedAt") && "${FUNCTION}"(b."reportedAt")`,
  );
  const conflictCount = Number(conflicts[0].count);
  if (conflictCount > 0) {
    throw new Error(
      `Hay ${conflictCount} pares de reportes que violarían la constraint ` +
        `(mismo usuario+plaza dentro de 60 s). Revisa los datos antes de aplicarla.`,
    );
  }
  console.log('✔ Sin datos que violen la futura constraint.');

  // 4) Crear la exclusion constraint. NOT VALID no aplica a EXCLUDE: se crea
  //    directamente. Capturamos «ya existe» (42710) por idempotencia ante
  //    ejecuciones concurrentes del propio script.
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "public"."${TABLE}"
        ADD CONSTRAINT "${CONSTRAINT}"
        EXCLUDE USING gist (
          "userId" WITH =,
          "spotId" WITH =,
          "${FUNCTION}"("reportedAt") WITH &&
        )
    `);
    console.log(`✔ Constraint ${CONSTRAINT} creada en ${TABLE} (cooldown de 60 s por usuario+plaza).`);
  } catch (error) {
    const code = (error as { meta?: { code?: string }; message?: string })?.meta?.code;
    const message = (error as { message?: string })?.message ?? String(error);
    if (code === '42710' || message.includes('already exists')) {
      console.log(`= La constraint ${CONSTRAINT} ya existía (carrera de setup). Nada que hacer.`);
    } else {
      throw error;
    }
  }

  // 5) Verificación final.
  const check = await prisma.$queryRawUnsafe<{ conname: string; contype: string }[]>(
    `SELECT conname, contype
       FROM pg_constraint
      WHERE conname = '${CONSTRAINT}'
        AND conrelid = 'public.${TABLE}'::regclass`,
  );
  if (check.length === 0) {
    throw new Error(`La constraint ${CONSTRAINT} no aparece en pg_constraint tras el setup.`);
  }
  // contype: x = exclusion
  console.log(`ℹ Verificada en pg_constraint: ${check[0].conname} (tipo '${check[0].contype}' = exclusion).`);
}

main()
  .catch((error) => {
    console.error('✖ Error configurando el cooldown de reportes:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
