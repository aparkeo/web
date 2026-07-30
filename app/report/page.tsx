'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { ReportModal } from '@/components/ReportModal';
import { Card, CardContent } from '@/components/ui/card';
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
            <Card
              key={spot.id}
              className="cursor-pointer transition-colors hover:bg-secondary/50"
              onClick={() => setTarget({ id: spot.id, street: spot.street })}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{spot.street}</p>
                  <p className="text-xs" style={{ color: colorForStatus(spot.status) }}>
                    {labelForStatus(spot.status)}
                  </p>
                </div>
                <Flag className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {target ? (
        <ReportModal spotId={target.id} street={target.street} open={!!target} onOpenChange={(o) => !o && setTarget(null)} />
      ) : null}
    </div>
  );
}
