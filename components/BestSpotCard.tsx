'use client';

import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NavigationButton } from '@/components/NavigationButton';
import { DestinationInput } from '@/components/DestinationInput';
import { useBestSpot } from '@/hooks/useBestSpot';
import { useDestinationStore } from '@/store/useDestinationStore';
import { formatDistance, formatWalkTime } from '@/lib/utils';

const CONFIDENCE_VARIANT = { Alta: 'success' as const, Media: 'warning' as const, Baja: 'muted' as const };

export function BestSpotCard() {
  const destination = useDestinationStore((s) => s.destination);
  const { data: best, isLoading } = useBestSpot();

  return (
    <div className="space-y-4">
      <DestinationInput />

      {!destination ? (
        <p className="text-center text-sm text-muted-foreground">
          Dinos a dónde vas (o usa tu ubicación actual) y te recomendamos la mejor plaza PMR para llegar allí.
        </p>
      ) : isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !best ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No hay plazas PMR cerca de «{destination.label}» con datos suficientes. Explora el mapa para ver más
            opciones.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" /> Recomendación cerca de tu destino
            </div>

            <h2 className="text-2xl font-extrabold">{best.street}</h2>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={CONFIDENCE_VARIANT[best.prediction.confidenceLabel]}>
                {Math.round(best.prediction.probabilityFree * 100)}% libre · confianza {best.prediction.confidenceLabel}
              </Badge>
              {best.distanceM !== undefined ? (
                <span className="text-sm text-muted-foreground">
                  {formatDistance(best.distanceM)} de «{destination.label}»
                  {formatWalkTime(best.distanceM) ? ` · ${formatWalkTime(best.distanceM)}` : ''}
                </span>
              ) : null}
            </div>

            <NavigationButton lat={best.lat} lon={best.lon} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
