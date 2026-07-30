'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { List, Map as MapIcon } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { Filters } from '@/components/Filters';
import { SpotCard } from '@/components/SpotCard';
import { MapErrorBoundary } from '@/components/MapErrorBoundary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSpots } from '@/hooks/useSpots';

const MapView = dynamic(() => import('@/components/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-muted-foreground">Cargando mapa…</div>,
});

export default function MapPage() {
  const { data: spots = [], isLoading } = useSpots();
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:flex-row">
      <aside
        className={`w-full shrink-0 overflow-y-auto border-r border-border bg-background md:block md:w-96 ${
          mobileView === 'list' ? 'block' : 'hidden'
        }`}
        aria-label="Lista de plazas"
      >
        <div className="space-y-3 p-4">
          <SearchBar />
          <Filters />
        </div>
        <div className="space-y-2 p-4 pt-0">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : spots.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Ninguna plaza coincide con los filtros.</p>
          ) : (
            spots.map((spot) => <SpotCard key={spot.id} spot={spot} />)
          )}
        </div>
      </aside>

      <div
        className={`relative flex-1 ${mobileView === 'map' ? 'block' : 'hidden md:block'}`}
        aria-label="Mapa interactivo"
        role="region"
      >
        <MapErrorBoundary>
          <MapView />
        </MapErrorBoundary>
      </div>

      <Button
        className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 gap-2 shadow-lg md:hidden"
        onClick={() => setMobileView((v) => (v === 'map' ? 'list' : 'map'))}
        aria-label={mobileView === 'map' ? 'Ver lista de plazas' : 'Ver mapa'}
      >
        {mobileView === 'map' ? (
          <>
            <List className="h-4 w-4" /> Ver lista
          </>
        ) : (
          <>
            <MapIcon className="h-4 w-4" /> Ver mapa
          </>
        )}
      </Button>
    </div>
  );
}
