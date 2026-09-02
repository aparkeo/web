'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { NavigationButton } from '@/components/NavigationButton';
import { useSpotPhotos } from '@/hooks/useSpotPhotos';
import { useT } from '@/components/i18n/I18nProvider';
import { formatDistance, formatWalkTime } from '@/lib/utils';
import type { SpotDTO } from '@/types';

/**
 * Tarjeta flotante de plaza: aparece con UN solo clic/toque en el pin
 * (antes hacía falta abrir el popup y luego «Ver detalles»). Muestra foto
 * (si la comunidad subió alguna), calle, estado, distancia y «Cómo llegar»
 * con Google Maps. Se cierra con la X, con Escape o al tocar otro pin.
 */
export function SpotPreviewCard({ spot, onClose }: { spot: SpotDTO; onClose: () => void }) {
  const t = useT();
  const { data: photos } = useSpotPhotos(spot.id);
  const photo = photos?.[0];
  const walk = spot.distanceM !== undefined ? formatWalkTime(spot.distanceM, t.time) : null;

  // Escape cierra la tarjeta (el foco queda donde estaba).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Card
      role="dialog"
      aria-label={spot.street}
      className="shadow-elevated absolute bottom-4 left-1/2 z-10 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl py-0"
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL externa de Supabase con dimensiones variables
        <img
          src={photo.url}
          alt={`${spot.street} — ${photo.authorName}`}
          className="h-28 w-full object-cover"
          loading="lazy"
        />
      ) : null}

      <Button
        variant="secondary"
        size="icon"
        type="button"
        onClick={onClose}
        aria-label={t.common.close}
        className="absolute right-2 top-2 h-9 w-9 rounded-full shadow-md"
      >
        <X className="h-4 w-4" />
      </Button>

      <CardContent className="flex flex-col gap-3 p-4">
        <div className="min-w-0 pr-8">
          <Link
            href={`/spots/${spot.id}`}
            className="block truncate rounded font-semibold tracking-tight transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {spot.street}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={spot.status} />
            {spot.distanceM !== undefined ? (
              <span className="text-xs text-muted-foreground">
                {formatDistance(spot.distanceM)}
                {walk ? ` · ${walk}` : ''}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          <NavigationButton
            lat={spot.lat}
            lon={spot.lon}
            street={spot.street}
            label={t.map.howToGet}
            className="h-11 flex-1 text-sm"
          />
          <Button asChild variant="outline" className="h-11 flex-1 text-sm">
            <Link href={`/spots/${spot.id}`}>{t.map.viewDetails}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
