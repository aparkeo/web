'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapContainer, TileLayer, Marker, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { useTheme } from 'next-themes';
import { LocateFixed, Loader2, Map as MapIcon, Satellite } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useSpots } from '@/hooks/useSpots';
import { useSpot } from '@/hooks/useSpot';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useMapStore } from '@/store/useMapStore';
import { useBaseLayerStore } from '@/store/useBaseLayerStore';
import { colorForStatus } from '@/lib/utils';
import { dedupeSpotsByProximity } from '@/lib/dedupeSpots';
import { SpotMarker } from '@/components/SpotMarker';
import { useT } from '@/components/i18n/I18nProvider';
import type { Bbox, SpotStatus } from '@/types';

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

// Debounce (ms) entre el último moveend y la petición de plazas del viewport.
const VIEWPORT_DEBOUNCE_MS = 400;
// Padding del bbox para que un paneo pequeño no deje huecos en los bordes.
const VIEWPORT_PAD_RATIO = 0.15;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * Publica el viewport actual en el store (con debounce y padding): useSpots
 * lo usa como queryKey/queryFn, así cada zona visitada queda cacheada por
 * React Query y volver a ella no repite la petición.
 */
function ViewportSync() {
  const setBbox = useMapStore((s) => s.setBbox);
  const setCenter = useMapStore((s) => s.setCenter);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const map = useMapEvents({
    moveend: () => schedulePublish(),
  });

  const schedulePublish = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const b = map.getBounds();
      const latPad = (b.getNorth() - b.getSouth()) * VIEWPORT_PAD_RATIO;
      const lonPad = (b.getEast() - b.getWest()) * VIEWPORT_PAD_RATIO;
      // 3 decimales (~111 m): evita entradas de caché por paneos mínimos.
      const bbox: Bbox = [
        Number(clamp(b.getSouth() - latPad, -90, 90).toFixed(3)),
        Number(clamp(b.getWest() - lonPad, -180, 180).toFixed(3)),
        Number(clamp(b.getNorth() + latPad, -90, 90).toFixed(3)),
        Number(clamp(b.getEast() + lonPad, -180, 180).toFixed(3)),
      ];
      setBbox(bbox);
      // Persistir el viewport real (paneo manual incluido): center+zoom se
      // guardan en localStorage vía persist y el mapa se abre aquí al volver.
      // FlyToCenter no reacciona porque el mapa YA está en esta posición.
      const c = map.getCenter();
      setCenter(
        [Number(c.lat.toFixed(5)), Number(c.lng.toFixed(5))],
        Number(map.getZoom().toFixed(2)),
      );
    }, VIEWPORT_DEBOUNCE_MS);
  }, [map, setBbox, setCenter]);

  useEffect(() => {
    // Carga inicial: publica el viewport en cuanto el mapa existe.
    schedulePublish();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [schedulePublish]);

  return null;
}

/**
 * Vuela al centro/zoom del store cuando cambian por una acción externa
 * (chips de ciudades, ?spot=, resultado de búsqueda). El paneo manual del
 * usuario TAMBIÉN escribe en el store (ViewportSync, para persistir el
 * viewport), así que la guarda compara con la posición REAL actual del mapa:
 * si el mapa ya está ahí (paneo manual, primer render) no se vuela.
 */
function FlyToCenter() {
  const map = useMap();
  const center = useMapStore((s) => s.center);
  const zoom = useMapStore((s) => s.zoom);

  useEffect(() => {
    const c = map.getCenter();
    const z = map.getZoom();
    // Épsilon ~11 m: cubre el redondeo a 5 decimales de ViewportSync.
    const alreadyThere =
      Math.abs(c.lat - center[0]) < 1e-4 &&
      Math.abs(c.lng - center[1]) < 1e-4 &&
      Math.abs(z - zoom) < 0.01;
    if (alreadyThere) return;
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [center, zoom, map]);

  return null;
}

/**
 * Apertura directa de una plaza (?spot=id): se pide por id aunque no esté
 * en el viewport actual, se selecciona y se centra el mapa en ella.
 */
function useSpotFromQuery() {
  const searchParams = useSearchParams();
  const setSelectedSpot = useMapStore((s) => s.setSelectedSpot);
  const setCenter = useMapStore((s) => s.setCenter);

  const raw = searchParams.get('spot');
  const spotId = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;

  const { data: spot } = useSpot(spotId);
  const handledRef = useRef<number | null>(null);

  useEffect(() => {
    if (!spot || spotId === null || handledRef.current === spotId) return;
    handledRef.current = spotId;
    setSelectedSpot(spotId);
    setCenter([spot.lat, spot.lon], 17);
  }, [spot, spotId, setSelectedSpot, setCenter]);

  return spot ?? null;
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
  const { data: spots = [], isLoading } = useSpots({ viewport: true });
  const queriedSpot = useSpotFromQuery();
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

  // La plaza de ?spot= se muestra aunque esté fuera del viewport cargado, y
  // se eliminan los duplicados físicos Vigo-oficial vs OSM (solo visual).
  const visibleSpots = useMemo(() => {
    const merged =
      queriedSpot && !spots.some((s) => s.id === queriedSpot.id) ? [...spots, queriedSpot] : spots;
    return dedupeSpotsByProximity(merged);
  }, [spots, queriedSpot]);

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
        <ViewportSync />
        <FlyToCenter />
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
            visibleSpots.map((spot) => (
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
