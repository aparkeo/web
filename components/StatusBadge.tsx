'use client';

import { Badge } from '@/components/ui/badge';
import { labelForStatus } from '@/lib/utils';
import type { SpotStatus } from '@/types';

const STATUS_VARIANT: Record<SpotStatus, { variant: 'success' | 'destructive' | 'muted' }> = {
  FREE: { variant: 'success' },
  OCCUPIED: { variant: 'destructive' },
  UNKNOWN: { variant: 'muted' },
};

export function StatusBadge({ status }: { status: SpotStatus }) {
  const config = STATUS_VARIANT[status];
  return <Badge variant={config.variant}>{labelForStatus(status)}</Badge>;
}
