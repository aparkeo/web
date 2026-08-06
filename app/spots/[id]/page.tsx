import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { SpotDetails } from '@/components/SpotDetails';
import { labelForStatus } from '@/lib/utils';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const spot = await prisma.parkingSpot.findUnique({ where: { id: Number(id) } });
  if (!spot) return { title: 'Plaza no encontrada' };
  const title = `Plaza PMR en ${spot.street}`;
  const description = `Plaza PMR en ${spot.street}, ${spot.city} — ahora mismo: ${labelForStatus(spot.status).toLowerCase()}. Estado en tiempo real, predicción de disponibilidad y reportes de la comunidad.`;
  return {
    title,
    description,
    alternates: { canonical: `/spots/${spot.id}` },
    openGraph: {
      title: `${title} | Aparkeo`,
      description,
    },
  };
}

export default async function SpotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="container max-w-4xl pb-16 pt-10 sm:pt-14">
      <SpotDetails spotId={Number(id)} />
    </div>
  );
}
