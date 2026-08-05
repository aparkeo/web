'use client';

import { Navigation2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/I18nProvider';
import { fmt } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';

export function NavigationButton({
  lat,
  lon,
  street,
  label,
  className,
}: {
  lat: number;
  lon: number;
  street?: string;
  label?: string;
  className?: string;
}) {
  const t = useT();
  // URL universal de Google Maps: abre la app nativa en móvil y la web en escritorio
  const href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
  const ariaLabel = fmt(t.bestSpot.howToGetAria, { street: street ?? t.bestSpot.theSpot });

  return (
    <Button asChild size="lg" className={cn('w-full gap-2', className)}>
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>
        <Navigation2 className="h-5 w-5" />
        {label ?? t.bestSpot.takeMe}
      </a>
    </Button>
  );
}
