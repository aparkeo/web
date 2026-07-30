'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, LocateFixed, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { searchAddress } from '@/services/geocode';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDestinationStore } from '@/store/useDestinationStore';

export function DestinationInput() {
  const { destination, setDestination } = useDestinationStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 350);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['geocode', debouncedQuery],
    queryFn: () => searchAddress(debouncedQuery),
    enabled: open && debouncedQuery.trim().length >= 3,
    staleTime: 60_000,
  });

  const useCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocError('Geolocalización no disponible en este dispositivo.');
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDestination({
          label: 'Tu ubicación actual',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          source: 'current-location',
        });
        setLocating(false);
        setOpen(false);
        setQuery('');
      },
      (err) => {
        setLocError(err.code === 1 ? 'Permiso de ubicación denegado.' : 'No se pudo obtener la ubicación.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  if (destination) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 truncate text-sm font-medium">{destination.label}</span>
        <button
          type="button"
          onClick={() => setDestination(null)}
          className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
          aria-label="Cambiar destino"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setLocError(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder="¿A dónde vas? (calle, zona, sitio en Vigo)"
          className="pl-9"
        />
      </div>

      {open ? (
        <Card className="absolute z-20 mt-1 w-full overflow-hidden p-1 shadow-lg">
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-60"
          >
            <LocateFixed className="h-4 w-4 text-primary" />
            {locating ? 'Localizando…' : 'Usar mi ubicación actual'}
          </button>

          {locError ? (
            <p className="px-3 py-1.5 text-xs text-destructive">{locError}</p>
          ) : null}

          {debouncedQuery.trim().length >= 3 ? (
            isFetching ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados en Vigo.</p>
            ) : (
              results.map((r, i) => (
                <button
                  type="button"
                  key={`${r.lat}-${r.lon}-${i}`}
                  onClick={() => {
                    setDestination({ label: r.label, latitude: r.lat, longitude: r.lon, source: 'search' });
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{r.label}</span>
                </button>
              ))
            )
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
