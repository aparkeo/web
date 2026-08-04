/**
 * Setup del bucket `spot-photos` de Supabase Storage (roadmap nº9).
 *
 * Se ejecuta con:  npx tsx scripts/setup-spot-photos-bucket.ts
 *
 * Crea:
 *  - El bucket público `spot-photos` (límite 5 MB, solo jpeg/png/webp).
 *  - La policy de SELECT público sobre storage.objects de ese bucket.
 *
 * NO se crean policies de INSERT/DELETE: con RLS activo en storage.objects,
 * la ausencia de policy significa que ni `anon` ni `authenticated` pueden
 * escribir; solo el service role (que bypassa RLS) puede subir/borrar. Ese
 * es exactamente el modelo que queremos: toda escritura pasa por la API
 * route del servidor con SUPABASE_SECRET_KEY (ver lib/supabaseStorage.ts).
 *
 * Es idempotente (ON CONFLICT / IF NOT EXISTS vía DROP + CREATE de policy).
 */
import { prisma } from '../lib/prisma';

async function main() {
  await prisma.$executeRawUnsafe(`
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'spot-photos',
      'spot-photos',
      true,
      5242880,
      ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE
      SET public = EXCLUDED.public,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types
  `);
  console.log('✔ Bucket spot-photos creado/actualizado (público, 5 MB, jpeg/png/webp).');

  // Policy de lectura pública. DROP IF EXISTS + CREATE para idempotencia
  // (CREATE POLICY IF NOT EXISTS no existe en PostgreSQL).
  await prisma.$executeRawUnsafe(`
    DROP POLICY IF EXISTS "spot-photos public read" ON storage.objects
  `);
  await prisma.$executeRawUnsafe(`
    CREATE POLICY "spot-photos public read"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'spot-photos')
  `);
  console.log('✔ Policy "spot-photos public read" aplicada en storage.objects.');
  console.log('ℹ Sin policies de INSERT/DELETE: solo el service role escribe (vía API del servidor).');
}

main()
  .catch((error) => {
    console.error('✖ Error configurando el bucket spot-photos:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
