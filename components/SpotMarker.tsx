'use client';

import { memo, useCallback } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import { colorForStatus, labelForStatus, formatDistance } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { SpotDTO, SpotStatus } from '@/types';

// Cache de iconos: máximo 6 instancias de L.divIcon (3 estados x 2 selección).
// Clave: `${status}-${selected}`.
const iconCache = new Map<string, L.DivIcon>();

function spotIcon(status: SpotStatus, selected: boolean): L.DivIcon {
  const key = `${status}-${selected}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const color = colorForStatus(status);
  const size = selected ? 30 : 22;
  const icon = L.divIcon({
    className: '',
    html: `<div class="spot-marker" style="width:${size}px;height:${size}px;background:${color};${selected ? 'box-shadow:0 0 0 4px ' + color + '55, 0 2px 6px rgba(0,0,0,.35);' : ''}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  iconCache.set(key, icon);
  return icon;
}

interface SpotMarkerProps {
  spot: SpotDTO;
  selected: boolean;
  onSelect: (id: number) => void;
}

export const SpotMarker = memo(function SpotMarker({ spot, selected, onSelect }: SpotMarkerProps) {
  const icon = spotIcon(spot.status, selected);
  const handleClick = useCallback(() => onSelect(spot.id), [onSelect, spot.id]);

  return (
    <Marker position={[spot.lat, spot.lon]} icon={icon} eventHandlers={{ click: handleClick }}>
      {/* El contenido del popup solo se monta para el marcador seleccionado */}
      {selected ? (
        <Popup>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{spot.street}</span>
            <span style={{ color: colorForStatus(spot.status) }} className="font-medium">
              {labelForStatus(spot.status)}
            </span>
            {spot.distanceM !== undefined ? (
              <span className="text-muted-foreground">{formatDistance(spot.distanceM)}</span>
            ) : null}
            <Button asChild size="sm" className="mt-1">
              <Link href={`/spots/${spot.id}`}>Ver detalles</Link>
            </Button>
          </div>
        </Popup>
      ) : null}
    </Marker>
  );
});
