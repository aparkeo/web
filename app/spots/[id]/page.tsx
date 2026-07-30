import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { SpotDetails } from '@/components/SpotDetails';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const spot = await prisma.parkingSpot.findUnique({ where: { id: Number(id) } });
  if (!spot) return { title: 'Plaza no encontrada' };
  return {
    title: `Plaza PMR en ${spot.street}`,
    description: `Estado en tiempo real y predicción de disponibilidad de la plaza PMR en ${spot.street}, Vigo.`,
  };
}

export default async function SpotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="container max-w-4xl py-8">
      <SpotDetails spotId={Number(id)} />
    </div>
  );
}
