'use client';

import { Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrediction } from '@/hooks/usePredictions';
import { formatRelativeTime } from '@/lib/utils';

const CONFIDENCE_VARIANT = {
  Alta: 'success' as const,
  Media: 'warning' as const,
  Baja: 'muted' as const,
};

const SOURCE_LABEL: Record<string, string> = {
  live: 'Reportes en vivo',
  historical: 'Patrón histórico',
  blended: 'Vivo + histórico',
  none: 'Sin datos suficientes',
};

export function PredictionCard({ spotId }: { spotId: number }) {
  const { data: prediction, isLoading } = usePrediction(spotId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-primary" /> Predicción inteligente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !prediction ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-primary">
                {Math.round(prediction.probabilityFree * 100)}%
              </span>
              <span className="text-sm text-muted-foreground">probabilidad libre</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Confianza:</span>
              <Badge variant={CONFIDENCE_VARIANT[prediction.confidenceLabel]}>{prediction.confidenceLabel}</Badge>
            </div>

            <div className="text-xs text-muted-foreground">
              {SOURCE_LABEL[prediction.source]}
              {prediction.lastUpdated ? ` · actualizado ${formatRelativeTime(new Date(prediction.lastUpdated))}` : ''}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
