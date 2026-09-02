'use client';

import { ExternalLink, Loader2, Navigation2, X } from 'lucide-react';
import { useT } from '@/components/i18n/I18nProvider';
import { fmt } from '@/lib/i18n/format';
import { formatDistance } from '@/lib/utils';
import type { RouteResult } from '@/app/api/route/route';

export type RoutePanelState = 'locating' | 'loading' | 'error' | 'ready';

/** «1 h 5 min» / «42 min» — texto corto para el panel de la ruta. */
function formatDuration(durationS: number): string {
  const mins = Math.max(1, Math.round(durationS / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/**
 * Panel superior de la ruta integrada («Cómo llegar» sin salir de Aparkeo):
 * estados localizando/calculando, error con fallback a Google Maps, y el
 * resumen distancia + tiempo con la X para quitar la ruta. aria-live para
 * que el lector de pantalla anuncie el resultado al llegar.
 */
export function RoutePanel({
  state,
  route,
  street,
  googleHref,
  onClose,
}: {
  state: RoutePanelState;
  route: RouteResult | undefined;
  street: string;
  googleHref: string;
  onClose: () => void;
}) {
  const t = useT();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={fmt(t.map.routeTo, { street })}
      className="absolute left-1/2 top-3 z-[1000] flex h-11 max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2.5 rounded-full border border-border bg-background px-4 shadow-lg"
    >
      {state === 'locating' || state === 'loading' ? (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
          <span className="truncate text-sm">
            {state === 'locating' ? t.destination.locating : t.map.routeCalculating}
          </span>
        </>
      ) : null}

      {state === 'error' ? (
        <span className="truncate text-sm">{t.map.routeError}</span>
      ) : null}

      {state === 'ready' && route ? (
        <>
          <Navigation2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate text-sm font-medium">
            {fmt(t.map.routeByCar, {
              distance: formatDistance(route.distanceM),
              duration: formatDuration(route.durationS),
            })}
          </span>
        </>
      ) : null}

      {/* Fallback universal: abre la app nativa de Google Maps con el destino.
          Siempre visible en error; en ready queda como opción secundaria. */}
      {state === 'error' || state === 'ready' ? (
        <a
          href={googleHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          {t.map.openInGoogle}
        </a>
      ) : null}

      <button
        type="button"
        onClick={onClose}
        aria-label={t.map.closeRoute}
        className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
