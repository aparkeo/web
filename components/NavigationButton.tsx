'use client';

import { Navigation2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NavigationButton({
  lat,
  lon,
  street,
  label = 'Llévame',
}: {
  lat: number;
  lon: number;
  street?: string;
  label?: string;
}) {
  // URL universal de Google Maps: abre la app nativa en móvil y la web en escritorio
  const href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
  const ariaLabel = `Cómo llegar a ${street ?? 'la plaza'} (se abre en una pestaña nueva)`;

  return (
    <Button asChild size="lg" className="w-full gap-2">
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>
        <Navigation2 className="h-5 w-5" />
        {label}
      </a>
    </Button>
  );
}
