'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { LocateFixed, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useSpots } from '@/hooks/useSpots';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useMapStore } from '@/store/useMapStore';
import { colorForStatus } from '@/lib/utils';
import { SpotMarker } from '@/components/SpotMarker';
import type { SpotStatus } from '@/types';

// Icono de cluster: círculo con el color del estado dominante entre sus hijos.
// El estado se detecta por el color del divIcon de cada marcador hijo.
function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const counts: Record<SpotStatus, number> = { FREE: 0, OCCUPIED: 0, UNKNOWN: 0 };
  const freeColor = colorForStatus('FREE');
  const occupiedColor = colorForStatus('OCCUPIED');

  for (const marker of cluster.getAllChildMarkers()) {
    const html = (marker.options.icon as L.DivIcon | undefined)?.options?.html;
    if (typeof html === 'string' && html.includes(freeColor)) counts.FREE += 1;
    else if (typeof html === 'string' && html.includes(occupiedColor)) counts.OCCUPIED += 1;
    else counts.UNKNOWN += 1;
  }

  const dominant: SpotStatus =
    counts.FREE >= counts.OCCUPIED && counts.FREE >= counts.UNKNOWN
      ? 'FREE'
      : counts.OCCUPIED >= counts.UNKNOWN
        ? 'OCCUPIED'
        : 'UNKNOWN';

  const color = colorForStatus(dominant);
  const count = cluster.getChildCount();
  const size = count < 10 ? 38 : count < 100 ? 44 : 50;

  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${count < 100 ? 14 : 12}px;font-family:inherit;">${count}</div>`,
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

// Al alternar entre lista y mapa en móvil el contenedor cambia de tamaño
// (display: none -> block); Leaflet necesita invalidateSize() para recalcular.
function InvalidateSizeOnVisible({ visible }: { visible: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!visible) return;
    const raf = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(raf);
  }, [visible, map]);

  return null;
}

function LocateButton() {
  const { locate, loading } = useUserLocation();

  return (
    <button
      type="button"
      onClick={locate}
      disabled={loading}
      aria-label="Mi ubicación"
      className="absolute bottom-28 right-3 z-[1000] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-colors hover:bg-secondary disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : (
        <LocateFixed className="h-5 w-5 text-primary" />
      )}
    </button>
  );
}

export function MapView({ visible = true }: { visible?: boolean }) {
  const { data: spots = [], isLoading } = useSpots();
  const center = useMapStore((s) => s.center);
  const zoom = useMapStore((s) => s.zoom);
  const selectedSpotId = useMapStore((s) => s.selectedSpotId);
  const setSelectedSpot = useMapStore((s) => s.setSelectedSpot);
  const userLocation = useMapStore((s) => s.userLocation);

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

  return (
    <div className="relative h-full w-full">
      <MapContainer center={center} zoom={zoom} className="h-full w-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        <ZoomControl position="bottomright" />
        <RecenterOnUser />
        <InvalidateSizeOnVisible visible={visible} />

        {userLocation ? (
          <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon} />
        ) : null}

        <MarkerClusterGroup
          chunkedLoading
          disableClusteringAtZoom={17}
          maxClusterRadius={60}
          iconCreateFunction={clusterIcon}
        >
          {!isLoading &&
            spots.map((spot) => (
              <SpotMarker
                key={spot.id}
                spot={spot}
                selected={spot.id === selectedSpotId}
                onSelect={setSelectedSpot}
              />
            ))}
        </MarkerClusterGroup>
      </MapContainer>
      <LocateButton />
    </div>
  );
}
