'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, LocateFixed, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { searchAddress } from '@/services/geocode';
import { parseNaturalQuery } from '@/lib/nlSearch';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDestinationStore } from '@/store/useDestinationStore';

export function DestinationInput() {
  const destination = useDestinationStore((s) => s.destination);
  const setDestination = useDestinationStore((s) => s.setDestination);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 350);

  // Búsqueda en lenguaje natural: si el parser entiende la consulta
  // («plaza libre cerca del Corte Inglés»), geocodificamos solo el lugar
  // extraído y arrastramos el filtro de estado al destino. Si no, se usa el
  // texto tal cual (flujo clásico, p.ej. una calle a secas).
  const parsed = useMemo(() => parseNaturalQuery(debouncedQuery), [debouncedQuery]);
  const geocodeQuery = parsed.place ?? debouncedQuery;

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['geocode', geocodeQuery],
    queryFn: () => searchAddress(geocodeQuery),
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
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  };

  if (destination) {
    return (
      <div className="flex min-h-12 items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-1.5 shadow-sm">
        <MapPin className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex-1 truncate text-sm font-medium">{destination.label}</span>
        <button
          type="button"
          onClick={() => setDestination(null)}
          className="-mr-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setLocError(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder="¿A dónde vas? (p. ej. «plaza libre cerca del Corte Inglés»)"
          className="h-12 rounded-xl pl-10 text-base shadow-sm transition-[box-shadow,border-color] duration-200 focus-visible:shadow-md"
        />
      </div>

      {open ? (
        <Card className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl p-1.5 shadow-elevated">
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none disabled:opacity-60"
          >
            <LocateFixed className="h-4 w-4 text-primary" />
            {locating ? 'Localizando…' : 'Usar mi ubicación actual'}
          </button>

          {locError ? (
            <p className="px-3 py-1.5 text-xs text-destructive">{locError}</p>
          ) : null}

          {debouncedQuery.trim().length >= 3 ? (
            isFetching ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">Buscando…</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">Sin resultados en Vigo.</p>
            ) : (
              results.map((r, i) => (
                <button
                  type="button"
                  key={`${r.lat}-${r.lon}-${i}`}
                  onClick={() => {
                    setDestination({
                      label: r.label,
                      latitude: r.lat,
                      longitude: r.lon,
                      source: 'search',
                      statusFilter: parsed.status ?? undefined,
                      interpretation: parsed.interpretation ?? undefined,
                    });
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex min-h-11 w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
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
