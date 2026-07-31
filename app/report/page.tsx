'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { ReportModal } from '@/components/ReportModal';
import { Skeleton } from '@/components/ui/skeleton';
import { useSpots } from '@/hooks/useSpots';
import { labelForStatus, colorForStatus } from '@/lib/utils';

export default function ReportPage() {
  const { data: spots = [], isLoading } = useSpots();
  const [target, setTarget] = useState<{ id: number; street: string } | null>(null);

  return (
    <div className="container max-w-xl py-8">
      <h1 className="mb-1 text-2xl font-extrabold">Reportar estado de una plaza</h1>
      <p className="mb-6 text-muted-foreground">
        Busca la plaza que has visto y dinos si está libre u ocupada. Cada reporte ayuda a toda la comunidad PMR.
      </p>

      <SearchBar />

      <div className="mt-4 space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : (
          spots.slice(0, 30).map((spot) => (
            <button
              key={spot.id}
              type="button"
              aria-pressed={target?.id === spot.id}
              onClick={() => setTarget({ id: spot.id, street: spot.street })}
              className="block w-full cursor-pointer rounded-xl border border-border bg-card text-left text-card-foreground shadow-sm transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="flex items-center justify-between p-4">
                <span>
                  <span className="block font-semibold">{spot.street}</span>
                  <span className="block text-xs" style={{ color: colorForStatus(spot.status) }}>
                    {labelForStatus(spot.status)}
                  </span>
                </span>
                <Flag className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </span>
            </button>
          ))
        )}
      </div>

      {target ? (
        <ReportModal spotId={target.id} street={target.street} open={!!target} onOpenChange={(o) => !o && setTarget(null)} />
      ) : null}
    </div>
  );
}
