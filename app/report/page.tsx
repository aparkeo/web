'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { ReportModal } from '@/components/ReportModal';
import { Skeleton } from '@/components/ui/skeleton';
import { useSpots } from '@/hooks/useSpots';
import { labelForStatus, statusTextClass } from '@/lib/utils';
import { spotsCountAnnouncement } from '@/lib/a11y';

export default function ReportPage() {
  const { data: spots = [], isLoading } = useSpots();
  const [target, setTarget] = useState<{ id: number; street: string } | null>(null);

  return (
    <div className="container max-w-xl pb-16 pt-10 sm:pt-14">
      <header className="home-fade-up mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Comunidad PMR</p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Reportar estado de una plaza</h1>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Busca la plaza que has visto y dinos si está libre u ocupada. Cada reporte ayuda a toda la comunidad PMR.
        </p>
      </header>

      <div className="home-fade-up home-fade-up-delay">
        <SearchBar />

        <div className="mt-4 space-y-2.5">
          {/* Región live: anuncia cuántas plazas coinciden con la búsqueda */}
          <p className="sr-only" role="status">
            {isLoading ? '' : spotsCountAnnouncement(spots.length)}
          </p>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
          ) : (
            spots.slice(0, 30).map((spot) => (
              <button
                key={spot.id}
                type="button"
                aria-pressed={target?.id === spot.id}
                onClick={() => setTarget({ id: spot.id, street: spot.street })}
                className="card-lift block min-h-16 w-full cursor-pointer rounded-2xl border border-border bg-card text-left text-card-foreground shadow-sm transition-[transform,box-shadow,background-color,border-color] duration-200 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-pressed:border-primary/50 aria-pressed:bg-primary/5"
              >
                <span className="flex items-center justify-between p-4">
                  <span>
                    <span className="block font-semibold tracking-tight">{spot.street}</span>
                    <span className={`block text-xs ${statusTextClass(spot.status)}`}>
                      {labelForStatus(spot.status)}
                    </span>
                  </span>
                  <Flag className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {target ? (
        <ReportModal spotId={target.id} street={target.street} open={!!target} onOpenChange={(o) => !o && setTarget(null)} />
      ) : null}
    </div>
  );
}
