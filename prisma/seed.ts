import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Seed mínimo para desarrollo local: solo el usuario admin de referencia.
 * Las plazas reales NO se siembran aquí con datos falsos — se importan del
 * dataset oficial del Concello con `npm run db:import-spots`
 * (scripts/import-spots.ts), igual que hace la app móvil.
 *
 * Password del admin: opcional, vía variable de entorno SEED_ADMIN_PASSWORD.
 * Sin ella el admin se crea sin contraseña (no puede hacer login por
 * credentials, solo OAuth). En producción NO definir una password trivial.
 */
async function main() {
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  const hashedPassword = seedPassword ? await bcrypt.hash(seedPassword, 10) : undefined;

  await prisma.user.upsert({
    where: { email: 'admin@minusvigo.dev' },
    // El password solo se establece al crear; en re-seeds no se machaca uno
    // ya cambiado por el propio admin.
    update: {},
    create: {
      email: 'admin@minusvigo.dev',
      name: 'Admin MinusVigo',
      role: 'ADMIN',
      password: hashedPassword,
    },
  });

  console.log('Seed completo: 1 admin. Ejecuta "npm run db:import-spots" para traer las plazas PMR reales.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
