'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MapErrorBoundaryProps {
  children: React.ReactNode;
}

export function MapErrorBoundary({ children }: MapErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      // Leaflet a veces lanza errores en ciertos entornos (p.ej. SSR hydration)
      if (event.message?.toLowerCase().includes('leaflet') || event.message?.toLowerCase().includes('map')) {
        setHasError(true);
      }
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);

  if (hasError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No se pudo cargar el mapa interactivo.</p>
        <Button variant="outline" size="sm" onClick={() => setHasError(false)}>
          Reintentar
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
