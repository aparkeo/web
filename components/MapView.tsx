'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import { useSpots } from '@/hooks/useSpots';
import { useMapStore } from '@/store/useMapStore';
import { colorForStatus, labelForStatus, formatDistance } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { SpotDTO } from '@/types';

function spotIcon(spot: SpotDTO, selected: boolean) {
  const color = colorForStatus(spot.status);
  const size = selected ? 30 : 22;
  return L.divIcon({
    className: '',
    html: `<div class="spot-marker" style="width:${size}px;height:${size}px;background:${color};${selected ? 'box-shadow:0 0 0 4px ' + color + '55, 0 2px 6px rgba(0,0,0,.35);' : ''}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function RecenterOnUser() {
  const map = useMap();
  const userLocation = useMapStore((s) => s.userLocation);

  useEffect(() => {
    if (userLocation) {
      map.setView([userLocation.latitude, userLocation.longitude], 16, { animate: true });
    }
  }, [userLocation, map]);

  return null;
}

export function MapView() {
  const { data: spots = [], isLoading } = useSpots();
  const { center, zoom, selectedSpotId, setSelectedSpot } = useMapStore();

  const userIcon = useMemo(
    () =>
      L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 0 0 6px rgba(37,99,235,0.25)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    [],
  );

  const userLocation = useMapStore((s) => s.userLocation);

  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full" zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterOnUser />

      {userLocation ? <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon} /> : null}

      {!isLoading &&
        spots.map((spot) => (
          <Marker
            key={spot.id}
            position={[spot.lat, spot.lon]}
            icon={spotIcon(spot, spot.id === selectedSpotId)}
            eventHandlers={{ click: () => setSelectedSpot(spot.id) }}
          >
            <Popup>
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">{spot.street}</span>
                <span style={{ color: colorForStatus(spot.status) }} className="font-medium">
                  {labelForStatus(spot.status)}
                </span>
                {spot.distanceM !== undefined ? <span className="text-muted-foreground">{formatDistance(spot.distanceM)}</span> : null}
                <Button asChild size="sm" className="mt-1">
                  <Link href={`/spots/${spot.id}`}>Ver detalles</Link>
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
