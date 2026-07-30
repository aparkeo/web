import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SOURCE_URL = process.env.PARKING_DATA_URL ?? 'https://datos.vigo.org/data/trafico/plazas_minusvalido.json';

interface RawSpot {
  id: number;
  lat: number;
  lon: number;
  calle: string;
  numplazas: number | null;
}

/**
 * Importa el dataset oficial de plazas PMR del Concello de Vigo (mismo feed
 * que usa la app móvil) a la tabla parking_spots. Solo crea o actualiza
 * street/lat/lon/spaces — nunca toca status/confidence, que son del
 * consenso de Report.
 */
async function main() {
  console.log(`Descargando ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar el dataset`);

  const rows = (await res.json()) as RawSpot[];
  const valid = rows.filter((r) => typeof r.lat === 'number' && typeof r.lon === 'number' && typeof r.id === 'number');
  console.log(`${valid.length} plazas válidas de ${rows.length} en el feed.`);

  let created = 0;
  let updated = 0;

  for (const r of valid) {
    const data = {
      street: r.calle?.trim() || 'Sin calle',
      lat: r.lat,
      lon: r.lon,
      spaces: r.numplazas ?? 1,
      city: 'Vigo',
    };

    const result = await prisma.parkingSpot.upsert({
      where: { id: r.id },
      update: data,
      create: { id: r.id, ...data },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) created += 1;
    else updated += 1;
  }

  console.log(`Importación completa: ${created} nuevas, ${updated} actualizadas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
