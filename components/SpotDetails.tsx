'use client';

import { useState } from 'react';
import { Star, MapPin, Flag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PredictionCard } from '@/components/PredictionCard';
import { NavigationButton } from '@/components/NavigationButton';
import { ReportModal } from '@/components/ReportModal';
import { useSpot } from '@/hooks/useSpot';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { formatRelativeTime, cn } from '@/lib/utils';

export function SpotDetails({ spotId }: { spotId: number }) {
  const { data: spot, isLoading, isError, refetch, isRefetching } = useSpot(spotId);
  const favoriteToggle = useFavoriteToggle();
  const [reportOpen, setReportOpen] = useState(false);

  if (isLoading) {
    return <Card className="h-64 animate-pulse" />;
  }

  if (isError || !spot) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-muted-foreground">No se pudo cargar la información de esta plaza.</p>
          <Button type="button" variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            {isRefetching ? 'Reintentando…' : 'Reintentar'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-xl">{spot.street}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="min-h-11 min-w-11"
              onClick={() => favoriteToggle.mutate(spot.id)}
              aria-label={spot.isFavorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
              aria-pressed={spot.isFavorite}
            >
              <Star className={cn('h-5 w-5', spot.isFavorite && 'fill-yellow-400 text-yellow-400')} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={spot.status} />
            {spot.confidence === 'CONFIRMED' ? <Badge variant="outline">✓ Confirmada por la comunidad</Badge> : null}
            {spot.confidence === 'DISPUTED' ? <Badge variant="warning">Informes contradictorios</Badge> : null}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Lat {spot.lat.toFixed(4)}, Lon {spot.lon.toFixed(4)} · {spot.spaces} plaza{spot.spaces > 1 ? 's' : ''}
          </div>

          {spot.lastReportAt ? (
            <p className="text-xs text-muted-foreground">
              Último reporte {formatRelativeTime(new Date(spot.lastReportAt))}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Todavía no hay reportes para esta plaza.</p>
          )}

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row">
            <NavigationButton lat={spot.lat} lon={spot.lon} street={spot.street} />
            <Button variant="outline" size="lg" className="gap-2" type="button" onClick={() => setReportOpen(true)}>
              <Flag className="h-4 w-4" /> Reportar estado
            </Button>
          </div>
        </CardContent>
      </Card>

      <PredictionCard spotId={spot.id} />

      <ReportModal spotId={spot.id} street={spot.street} open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
}
