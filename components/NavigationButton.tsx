'use client';

import { Navigation2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NavigationButton({ lat, lon, label = 'Llévame' }: { lat: number; lon: number; label?: string }) {
  const href = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=;${lat}%2C${lon}`;

  return (
    <Button asChild size="lg" className="w-full gap-2">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <Navigation2 className="h-5 w-5" />
        {label}
      </a>
    </Button>
  );
}
