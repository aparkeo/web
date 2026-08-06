'use client';

import { QUICK_CITIES } from '@/lib/cities';
import { useMapStore } from '@/store/useMapStore';
import { useT } from '@/components/i18n/I18nProvider';

/**
 * Chips de acceso rápido a ciudades principales: centran el mapa (vuelo) y
 * la carga por viewport trae las plazas de la zona. Scroll horizontal en
 * móvil; tap targets >= 44 px por accesibilidad.
 */
export function QuickCities() {
  const setCenter = useMapStore((s) => s.setCenter);
  const t = useT();

  return (
    <div
      role="group"
      aria-label={t.map.quickCities}
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
    >
      {QUICK_CITIES.map((city) => (
        <button
          key={city.name}
          type="button"
          onClick={() => setCenter([city.lat, city.lon], city.zoom)}
          className="flex min-h-11 shrink-0 items-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition-colors duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {city.name}
        </button>
      ))}
    </div>
  );
}
