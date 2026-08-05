'use client';

import { Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrediction } from '@/hooks/usePredictions';
import { useT } from '@/components/i18n/I18nProvider';
import { fmt } from '@/lib/i18n/format';
import { formatRelativeTime } from '@/lib/utils';

const CONFIDENCE_VARIANT = {
  Alta: 'success' as const,
  Media: 'warning' as const,
  Baja: 'muted' as const,
};

export function PredictionCard({ spotId }: { spotId: number }) {
  const { data: prediction, isLoading, isError, refetch, isRefetching } = usePrediction(spotId);
  const t = useT();

  return (
    <Card className="rounded-2xl shadow-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base tracking-tight">
          <Brain className="h-4 w-4 text-primary" /> {t.prediction.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : isError || !prediction ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t.prediction.loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              {isRefetching ? t.common.retrying : t.common.retry}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-primary">
                {Math.round(prediction.probabilityFree * 100)}%
              </span>
              <span className="text-sm text-muted-foreground">{t.prediction.probabilityFree}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t.prediction.confidenceLabel}</span>
              <Badge variant={CONFIDENCE_VARIANT[prediction.confidenceLabel]}>
                {t.prediction.confidence[prediction.confidenceLabel]}
              </Badge>
            </div>

            <div className="text-xs text-muted-foreground">
              {t.prediction.source[prediction.source as keyof typeof t.prediction.source] ?? prediction.source}
              {prediction.lastUpdated
                ? ` · ${fmt(t.prediction.updated, { time: formatRelativeTime(new Date(prediction.lastUpdated), t.time) })}`
                : ''}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
