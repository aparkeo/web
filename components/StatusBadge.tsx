'use client';

import { Badge } from '@/components/ui/badge';
import { useT } from '@/components/i18n/I18nProvider';
import type { SpotStatus } from '@/types';

const STATUS_VARIANT: Record<SpotStatus, { variant: 'success' | 'destructive' | 'muted' }> = {
  FREE: { variant: 'success' },
  OCCUPIED: { variant: 'destructive' },
  UNKNOWN: { variant: 'muted' },
};

export function StatusBadge({ status }: { status: SpotStatus }) {
  const t = useT();
  const config = STATUS_VARIANT[status];
  const label =
    status === 'FREE' ? t.status.free : status === 'OCCUPIED' ? t.status.occupied : t.status.unknown;
  return <Badge variant={config.variant}>{label}</Badge>;
}
