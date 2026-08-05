'use client';

import Link from 'next/link';
import { Star, Navigation2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useT } from '@/components/i18n/I18nProvider';
import { formatDistance, formatWalkTime } from '@/lib/utils';
import type { SpotDTO } from '@/types';

export function SpotCard({ spot }: { spot: SpotDTO }) {
  const favoriteToggle = useFavoriteToggle();
  const t = useT();
  const walk = spot.distanceM !== undefined ? formatWalkTime(spot.distanceM, t.time) : null;

  return (
    <Card className="card-lift rounded-2xl">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/spots/${spot.id}`}
            className="rounded font-semibold tracking-tight transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {spot.street}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={spot.status} />
            {spot.confidence === 'CONFIRMED' ? <Badge variant="outline">{t.status.confirmed}</Badge> : null}
            {spot.distanceM !== undefined ? (
              <span className="text-xs text-muted-foreground">
                {formatDistance(spot.distanceM)}
                {walk ? ` · ${walk}` : ''}
              </span>
            ) : null}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => favoriteToggle.mutate(spot.id)}
          aria-label={spot.isFavorite ? t.map.removeFavorite : t.map.addFavorite}
          className="h-11 w-11 shrink-0 rounded-full transition-colors duration-150"
        >
          {/* amber-600 (3.5:1) en claro / amber-400 en oscuro: yellow-400 no
              llegaba ni al 3:1 de contraste no-textual sobre fondo claro */}
          <Star
            className={
              spot.isFavorite
                ? 'h-5 w-5 fill-amber-500 text-amber-600 dark:fill-amber-400 dark:text-amber-400'
                : 'h-5 w-5'
            }
          />
        </Button>

        <Button asChild size="icon" aria-label={t.map.howToGet} className="h-11 w-11 shrink-0 rounded-full">
          <a
            href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=;${spot.lat}%2C${spot.lon}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation2 className="h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
