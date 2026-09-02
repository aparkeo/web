'use client';

import { memo, useCallback } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { colorForStatus } from '@/lib/utils';
import { WHEELCHAIR_GLYPH } from '@/lib/markers';
import { useT } from '@/components/i18n/I18nProvider';
import { fmt } from '@/lib/i18n/format';
import type { Dictionary } from '@/lib/i18n';
import type { SpotDTO, SpotStatus } from '@/types';

// Cache de iconos: máximo 6 instancias de L.divIcon (3 estados x 2 selección).
// Clave: `${status}-${selected}`.
const iconCache = new Map<string, L.DivIcon>();

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
    // Un solo clic/toque abre la tarjeta flotante (SpotPreviewCard en
    // MapView). title da nombre accesible al marcador: Leaflet pone
    // tabindex=0 + role="button" al icono y con Enter se selecciona igual.
    <Marker
      position={[spot.lat, spot.lon]}
      icon={icon}
      title={fmt(t.map.markerTitle, { street: spot.street, status: label })}
      eventHandlers={{ click: handleClick }}
    />
  );
});
