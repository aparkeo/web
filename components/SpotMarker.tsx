'use client';

import { memo, useCallback } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import { colorForStatus, statusTextClass, formatDistance } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/I18nProvider';
import { fmt } from '@/lib/i18n/format';
import type { Dictionary } from '@/lib/i18n';
import type { SpotDTO, SpotStatus } from '@/types';

// Cache de iconos: máximo 6 instancias de L.divIcon (3 estados x 2 selección).
// Clave: `${status}-${selected}`.
const iconCache = new Map<string, L.DivIcon>();

// Símbolo internacional de accesibilidad (silla de ruedas) en viewBox 24x24.
// Dibujado en blanco sobre el pin de color: reconocible al instante como
// plaza PMR y legible en claro y en oscuro.
const WHEELCHAIR_GLYPH = `
  <path d="M12 4c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"/>
  <path d="M19 13v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.17-.19-.38-.34-.61-.45-.01 0-.01-.01-.02-.01H13c-.35-.2-.75-.3-1.19-.26C10.76 7.11 10 8.01 10 9.09V15c0 1.1.9 2 2 2h5v5h2v-5.5c0-1.1-.9-2-2-2h-3v-3.45c1.29 1.07 3.25 1.94 5 1.95z"/>
  <path d="M12.83 18c-.41 1.16-1.52 2-2.83 2-1.66 0-3-1.34-3-3 0-1.31.84-2.41 2-2.83V12.1c-2.28.46-4 2.48-4 4.9 0 2.76 2.24 5 5 5 2.42 0 4.44-1.72 4.9-4h-2.07z"/>`;

// Pin tipo "gota" con el glifo de accesibilidad dentro. El fill lleva el hex
// del estado: clusterIcon (MapView) detecta el estado dominante buscando ese
// hex en el HTML de los marcadores hijos — mantenerlo presente.
function pinSvg(color: string): string {
  return `<svg viewBox="0 0 32 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16 1C8.3 1 2 7.3 2 15c0 9.9 12.2 22.6 13.3 23.6a1.1 1.1 0 0 0 1.4 0C17.8 37.6 30 24.9 30 15 30 7.3 23.7 1 16 1z" fill="${color}" stroke="#fff" stroke-width="2.5"/><g transform="translate(6.7,5.3) scale(0.78)" fill="#fff">${WHEELCHAIR_GLYPH}</g></svg>`;
}

function spotIcon(status: SpotStatus, selected: boolean): L.DivIcon {
  const key = `${status}-${selected}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const color = colorForStatus(status);
  // Tap target WCAG 2.2 AA: mínimo 24x24 px de ancho.
  const w = selected ? 34 : 28;
  const h = Math.round((w * 44) / 32);
  const icon = L.divIcon({
    className: '',
    html: `<div class="spot-pin${selected ? ' spot-pin--selected' : ''}" style="width:${w}px;height:${h}px;color:${color}">${pinSvg(color)}</div>`,
    iconSize: [w, h],
    // La punta del pin marca el punto exacto de la plaza.
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
  });
  iconCache.set(key, icon);
  return icon;
}

function statusLabel(t: Dictionary, status: SpotStatus): string {
  return status === 'FREE' ? t.status.free : status === 'OCCUPIED' ? t.status.occupied : t.status.unknown;
}

interface SpotMarkerProps {
  spot: SpotDTO;
  selected: boolean;
  onSelect: (id: number) => void;
}

export const SpotMarker = memo(function SpotMarker({ spot, selected, onSelect }: SpotMarkerProps) {
  const t = useT();
  const icon = spotIcon(spot.status, selected);
  const handleClick = useCallback(() => onSelect(spot.id), [onSelect, spot.id]);
  const label = statusLabel(t, spot.status);

  return (
    // title da nombre accesible al marcador: Leaflet pone tabindex=0 +
    // role="button" al icono (keyboard: true por defecto) y title actúa como
    // accessible name; con Enter se abre el popup y el foco entra en él.
    <Marker
      position={[spot.lat, spot.lon]}
      icon={icon}
      title={fmt(t.map.markerTitle, { street: spot.street, status: label })}
      eventHandlers={{ click: handleClick }}
    >
      {/* El contenido del popup solo se monta para el marcador seleccionado */}
      {selected ? (
        <Popup>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{spot.street}</span>
            <span className={`font-medium ${statusTextClass(spot.status)}`}>{label}</span>
            {spot.distanceM !== undefined ? (
              <span className="text-muted-foreground">{formatDistance(spot.distanceM)}</span>
            ) : null}
            <Button asChild size="sm" className="mt-1">
              <Link href={`/spots/${spot.id}`}>{t.map.viewDetails}</Link>
            </Button>
          </div>
        </Popup>
      ) : null}
    </Marker>
  );
});
