'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { List, Map as MapIcon, MapPinOff } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { Filters } from '@/components/Filters';
import { SpotCard } from '@/components/SpotCard';
import { MapErrorBoundary } from '@/components/MapErrorBoundary';
import { LiveIndicator } from '@/components/LiveIndicator';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSpots } from '@/hooks/useSpots';
import { useRealtimeSpots } from '@/hooks/useRealtimeSpots';
import { spotsCountAnnouncement } from '@/lib/a11y';
import { useT } from '@/components/i18n/I18nProvider';

const MapView = dynamic(() => import('@/components/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <MapLoadingFallback />,
});

function MapLoadingFallback() {
  const t = useT();
  return <div className="flex h-full items-center justify-center text-muted-foreground">{t.common.loadingMap}</div>;
}

export default function MapPage() {
  const { data: spots = [], isLoading } = useSpots();
  const live = useRealtimeSpots();
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
  const t = useT();

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:flex-row">
      <aside
        className={`sidebar-scroll w-full shrink-0 overflow-y-auto border-r border-border bg-background md:block md:w-96 ${
          mobileView === 'list' ? 'block' : 'hidden'
        }`}
        aria-label={t.map.listAria}
      >
        <div className="space-y-3 p-4">
          <SearchBar />
          <Filters />
          <LiveIndicator live={live} />
        </div>
        <div className="space-y-2.5 p-4 pt-0">
          {/* Región live: anuncia cuántas plazas hay tras cargar/filtrar o
              cuando el feed en tiempo real actualiza la lista */}
          <p className="sr-only" role="status">
            {isLoading ? '' : spotsCountAnnouncement(spots.length, t.a11y)}
          </p>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
          ) : spots.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
              <MapPinOff className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t.a11y.noSpotsMatch}</p>
            </div>
          ) : (
            spots.map((spot) => <SpotCard key={spot.id} spot={spot} />)
          )}
        </div>
      </aside>

      <div
        className={`relative flex-1 ${mobileView === 'map' ? 'block' : 'hidden md:block'}`}
        aria-label={t.map.regionAria}
        role="region"
        data-tour="map"
      >
        <MapErrorBoundary>
          <MapView visible={mobileView === 'map'} />
        </MapErrorBoundary>
      </div>

      <Button
        className="shadow-elevated fixed bottom-4 left-1/2 z-30 min-h-12 -translate-x-1/2 gap-2 rounded-full px-5 text-sm font-bold transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 md:hidden"
        onClick={() => setMobileView((v) => (v === 'map' ? 'list' : 'map'))}
        aria-label={mobileView === 'map' ? t.map.viewListAria : t.map.viewMapAria}
      >
        {mobileView === 'map' ? (
          <>
            <List className="h-4 w-4" /> {t.map.viewList}
          </>
        ) : (
          <>
            <MapIcon className="h-4 w-4" /> {t.map.viewMap}
          </>
        )}
      </Button>
    </div>
  );
}
