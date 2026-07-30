import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed mínimo para desarrollo local: solo el usuario admin de referencia.
 * Las plazas reales NO se siembran aquí con datos falsos — se importan del
 * dataset oficial del Concello con `npm run db:import-spots`
 * (scripts/import-spots.ts), igual que hace la app móvil.
 */
async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@minusvigo.dev' },
    update: {},
    create: {
      email: 'admin@minusvigo.dev',
      name: 'Admin MinusVigo',
      role: 'ADMIN',
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
