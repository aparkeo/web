import Link from 'next/link';
import { Map, BarChart3 } from 'lucide-react';
import { BestSpotCard } from '@/components/BestSpotCard';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="container max-w-2xl py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">¿Dónde aparco?</h1>
        <p className="mt-2 text-muted-foreground">
          Dinos a dónde vas y te recomendamos la mejor plaza PMR libre para llegar allí. Sin explorar mapas.
        </p>
      </div>

      <BestSpotCard />

      <div className="mt-6 flex justify-center gap-4 text-sm">
        <Button variant="link" asChild className="gap-1.5">
          <Link href="/map">
            <Map className="h-4 w-4" /> Ver mapa completo
          </Link>
        </Button>
        <Button variant="link" asChild className="gap-1.5">
          <Link href="/stats">
            <BarChart3 className="h-4 w-4" /> Ver estadísticas
          </Link>
        </Button>
      </div>
    </div>
  );
}
