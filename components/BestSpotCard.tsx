'use client';

import { Footprints, MapPinOff, Sparkles, WifiOff, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NavigationButton } from '@/components/NavigationButton';
import { DestinationInput } from '@/components/DestinationInput';
import { StatusBadge } from '@/components/StatusBadge';
import { useBestSpot } from '@/hooks/useBestSpot';
import { useDestinationStore } from '@/store/useDestinationStore';
import { formatDistance, formatWalkTime } from '@/lib/utils';

const CONFIDENCE_VARIANT = { Alta: 'success' as const, Media: 'warning' as const, Baja: 'muted' as const };

const CTA_CLASS =
  'min-h-12 rounded-xl text-base font-bold shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.55)] transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-8px_hsl(var(--primary)/0.65)] active:translate-y-0';

export function BestSpotCard() {
  const destination = useDestinationStore((s) => s.destination);
  const setDestination = useDestinationStore((s) => s.setDestination);
  const { data: best, isLoading, isError, refetch, isRefetching } = useBestSpot();

  // Quita solo el filtro/interpretación de la búsqueda en lenguaje natural,
  // conservando el destino elegido.
  const clearInterpretation = () => {
    if (!destination) return;
    setDestination({ ...destination, statusFilter: undefined, interpretation: undefined });
  };

  return (
    <div className="space-y-5">
      <DestinationInput />

      {destination?.interpretation ? (
        <p className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1">
            Entendido: <strong className="font-semibold text-foreground">{destination.interpretation}</strong>
          </span>
          <button
            type="button"
            onClick={clearInterpretation}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Quitar el filtro de la búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        </p>
      ) : null}

      {/* aria-live: la recomendación llega de forma asíncrona tras elegir
          destino; sin región live un lector de pantalla no se enteraría */}
      <div aria-live="polite">
      {!destination ? (
        <p className="mx-auto max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
          Dinos a dónde vas (o usa tu ubicación actual) y te recomendamos la mejor plaza PMR para llegar allí.
        </p>
      ) : isLoading ? (
        <Skeleton className="h-56 w-full rounded-2xl" />
      ) : isError ? (
        <Card className="rounded-2xl shadow-elevated">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <WifiOff className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              No se pudo buscar la mejor plaza cerca de «{destination.label}». Revisa tu conexión.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="min-h-11 rounded-xl px-6 transition-[transform,background-color] duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {isRefetching ? 'Reintentando…' : 'Reintentar'}
            </Button>
          </CardContent>
        </Card>
      ) : !best ? (
        <Card className="rounded-2xl border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <MapPinOff className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              No hay plazas PMR cerca de «{destination.label}» con datos suficientes. Explora el mapa para ver más
              opciones.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card shadow-elevated">
          <CardContent className="space-y-5 p-6 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 pt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-4 w-4" />
                Recomendación cerca de tu destino
              </p>
              <StatusBadge status={best.status} />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{best.street}</h2>
              {best.distanceM !== undefined ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Footprints className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <strong className="font-semibold text-foreground">{formatDistance(best.distanceM)}</strong> de «
                    {destination.label}»
                    {formatWalkTime(best.distanceM) ? ` · ${formatWalkTime(best.distanceM)}` : ''}
                  </span>
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={CONFIDENCE_VARIANT[best.prediction.confidenceLabel]} className="px-3 py-1 text-sm">
                {Math.round(best.prediction.probabilityFree * 100)}% libre
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                confianza {best.prediction.confidenceLabel}
              </Badge>
            </div>

            <NavigationButton lat={best.lat} lon={best.lon} street={best.street} className={CTA_CLASS} />
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
