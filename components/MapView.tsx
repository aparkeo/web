'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { useTheme } from 'next-themes';
import { LocateFixed, Loader2, Map as MapIcon, Satellite } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useSpots } from '@/hooks/useSpots';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useMapStore } from '@/store/useMapStore';
import { useBaseLayerStore } from '@/store/useBaseLayerStore';
import { colorForStatus } from '@/lib/utils';
import { SpotMarker } from '@/components/SpotMarker';
import { useT } from '@/components/i18n/I18nProvider';
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

// Tiles CARTO: Voyager (claro) y Dark Matter (oscuro). Misma atribución en ambos.
const TILE_URLS = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
} as const;
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Capa de tiles reactiva al tema: la key fuerza el remount SOLO del TileLayer
// (React Leaflet no actualiza la URL en caliente), sin tocar el MapContainer.
function ThemedTileLayer() {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <TileLayer
      key={mode}
      attribution={TILE_ATTRIBUTION}
      url={TILE_URLS[mode]}
      subdomains="abcd"
      maxZoom={20}
    />
  );
}

// Tiles Esri: World Imagery (fotos aéreas) + etiquetas de referencia encima
// (límites y topónimos) para que las calles se lean sobre el satélite.
// En satélite no aplica el tema claro/oscuro: las fotos aéreas son las fotos.
const SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_LABELS_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_TILE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

function SatelliteTileLayers() {
  return (
    <>
      <TileLayer
        key="esri-world-imagery"
        attribution={SATELLITE_TILE_ATTRIBUTION}
        url={SATELLITE_TILE_URL}
        maxZoom={20}
      />
      <TileLayer
        key="esri-reference-labels"
        attribution="Esri"
        url={SATELLITE_LABELS_TILE_URL}
        maxZoom={20}
      />
    </>
  );
}

// Capa base según la preferencia persistida: CARTO temático o satélite Esri.
function BaseLayers() {
  const baseLayer = useBaseLayerStore((s) => s.baseLayer);
  return baseLayer === 'satellite' ? <SatelliteTileLayers /> : <ThemedTileLayer />;
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
  const t = useT();

  return (
    <button
      type="button"
      onClick={locate}
      disabled={loading}
      aria-label={t.map.myLocation}
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

// Selector de capa base: "Mapa" (CARTO temático) o "Satélite" (Esri).
// Esquina superior derecha: no colisiona con el ZoomControl (abajo derecha)
// ni con "Mi ubicación" (bottom-28 right-3). Botones reales con aria-pressed
// y tap target >= 44px (h-11), estilos con tokens (válidos en ambos temas).
function BaseLayerControl() {
  const baseLayer = useBaseLayerStore((s) => s.baseLayer);
  const setBaseLayer = useBaseLayerStore((s) => s.setBaseLayer);
  const t = useT();

  const options = [
    { value: 'map' as const, label: t.map.baseLayerMap, ariaLabel: t.map.baseLayerMapAria, Icon: MapIcon },
    { value: 'satellite' as const, label: t.map.baseLayerSatellite, ariaLabel: t.map.baseLayerSatelliteAria, Icon: Satellite },
  ];

  return (
    <div
      role="group"
      aria-label={t.map.baseLayerGroup}
      className="absolute right-3 top-3 z-[1000] flex overflow-hidden rounded-full border border-border bg-background shadow-lg"
    >
      {options.map(({ value, label, ariaLabel, Icon }) => {
        const active = baseLayer === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={ariaLabel}
            onClick={() => setBaseLayer(value)}
            className={`flex h-11 items-center gap-1.5 px-4 text-sm font-medium transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-foreground hover:bg-secondary'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function MapView({ visible = true }: { visible?: boolean }) {
  const { data: spots = [], isLoading } = useSpots();
  const center = useMapStore((s) => s.center);
  const zoom = useMapStore((s) => s.zoom);
  const selectedSpotId = useMapStore((s) => s.selectedSpotId);
  const setSelectedSpot = useMapStore((s) => s.setSelectedSpot);
  const userLocation = useMapStore((s) => s.userLocation);
  const t = useT();

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
      {/* keyboard es true por defecto en Leaflet (pan/zoom con teclado y
          marcadores focuseables); se declara explícito a modo de contrato a11y */}
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        zoomControl={false}
        keyboard
        aria-label={t.map.fullAria}
      >
        <BaseLayers />
        <ZoomControl position="bottomright" />
        <RecenterOnUser />
        <InvalidateSizeOnVisible visible={visible} />

        {userLocation ? (
          // keyboard={false}: el punto de ubicación no es interactivo, no debe
          // entrar en el orden de tabulación ni ocupar un target de 16 px
          <Marker
            position={[userLocation.latitude, userLocation.longitude]}
            icon={userIcon}
            keyboard={false}
          />
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
      <BaseLayerControl />
      <LocateButton />
    </div>
  );
}
