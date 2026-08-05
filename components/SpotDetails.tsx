'use client';

import { useState } from 'react';
import { Star, MapPin, Flag, BellRing } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PredictionCard } from '@/components/PredictionCard';
import { NavigationButton } from '@/components/NavigationButton';
import { ReportModal } from '@/components/ReportModal';
import { SpotPhotos } from '@/components/SpotPhotos';
import { SpotComments } from '@/components/SpotComments';
import { LiveIndicator } from '@/components/LiveIndicator';
import { ShareButton } from '@/components/ShareButton';
import { useSpot } from '@/hooks/useSpot';
import { useRealtimeSpot } from '@/hooks/useRealtimeSpot';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { formatRelativeTime, cn } from '@/lib/utils';
import { useT } from '@/components/i18n/I18nProvider';
import { fmt } from '@/lib/i18n/format';

export function SpotDetails({ spotId }: { spotId: number }) {
  const { data: spot, isLoading, isError, refetch, isRefetching } = useSpot(spotId);
  const live = useRealtimeSpot(spotId);
  const favoriteToggle = useFavoriteToggle();
  const push = usePushSubscription();
  const [reportOpen, setReportOpen] = useState(false);
  const t = useT();

  if (isLoading) {
    return <Card className="h-64 animate-pulse rounded-2xl shadow-elevated" />;
  }

  if (isError || !spot) {
    return (
      <Card className="rounded-2xl shadow-elevated">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-muted-foreground">{t.spot.loadError}</p>
          <Button type="button" variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            {isRefetching ? t.common.retrying : t.common.retry}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="home-fade-up rounded-2xl shadow-elevated">
          <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t.spot.kicker}</p>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-2xl font-extrabold tracking-tight">{spot.street}</CardTitle>
            <div className="flex items-center">
              <ShareButton
                title={fmt(t.spot.shareTitle, { street: spot.street })}
                text={fmt(t.spot.shareText, { street: spot.street })}
              />
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="min-h-11 min-w-11"
                onClick={() => favoriteToggle.mutate(spot.id)}
                aria-label={spot.isFavorite ? t.spot.removeFavorite : t.spot.markFavorite}
                aria-pressed={spot.isFavorite}
              >
                <Star
                  className={cn(
                    'h-5 w-5',
                    spot.isFavorite && 'fill-amber-500 text-amber-600 dark:fill-amber-400 dark:text-amber-400',
                  )}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={spot.status} />
            {spot.confidence === 'CONFIRMED' ? <Badge variant="outline">{t.status.confirmedByCommunity}</Badge> : null}
            {spot.confidence === 'DISPUTED' ? <Badge variant="warning">{t.status.disputed}</Badge> : null}
            <LiveIndicator live={live} />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Lat {spot.lat.toFixed(4)}, Lon {spot.lon.toFixed(4)} · {spot.spaces} {spot.spaces > 1 ? t.spot.spaceMany : t.spot.spaceOne}
          </div>

          {spot.lastReportAt ? (
            <p className="text-xs text-muted-foreground">
              {fmt(t.spot.lastReport, { time: formatRelativeTime(new Date(spot.lastReportAt), t.time) })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t.spot.noReports}</p>
          )}

          {spot.isFavorite ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-border bg-secondary/60 p-3 text-sm"
            >
              <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {t.spot.willNotify}
                {push.supported && !push.subscribed ? t.spot.enablePushHint : ''}
              </span>
            </div>
          ) : null}

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row">
            <NavigationButton lat={spot.lat} lon={spot.lon} street={spot.street} className="btn-cta" />
            <Button variant="outline" size="lg" className="gap-2" type="button" onClick={() => setReportOpen(true)}>
              <Flag className="h-4 w-4" /> {t.spot.reportStatus}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="home-fade-up home-fade-up-delay">
        <PredictionCard spotId={spot.id} />
      </div>
      </div>

      <SpotPhotos spotId={spot.id} street={spot.street} />
      <SpotComments spotId={spot.id} />

      <ReportModal spotId={spot.id} street={spot.street} open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
}
