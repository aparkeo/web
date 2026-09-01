import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '@/store/useMapStore';

const GALICIA_CENTER: [number, number] = [42.65, -8.0];
const GALICIA_ZOOM = 8;

describe('useMapStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useMapStore.setState({
      selectedSpotId: null,
      userLocation: null,
      center: GALICIA_CENTER,
      zoom: GALICIA_ZOOM,
      bbox: null,
    });
  });

  it('empieza con la vista de Galicia por defecto', () => {
    const s = useMapStore.getState();
    expect(s.center).toEqual(GALICIA_CENTER);
    expect(s.zoom).toBe(GALICIA_ZOOM);
  });

  it('setCenter actualiza centro y zoom (o conserva el zoom si no se pasa)', () => {
    useMapStore.getState().setCenter([42.24, -8.72], 15);
    expect(useMapStore.getState().center).toEqual([42.24, -8.72]);
    expect(useMapStore.getState().zoom).toBe(15);

    useMapStore.getState().setCenter([42.88, -8.54]);
    expect(useMapStore.getState().center).toEqual([42.88, -8.54]);
    expect(useMapStore.getState().zoom).toBe(15);
  });

  it('persiste solo center+zoom en localStorage', () => {
    useMapStore.getState().setSelectedSpot(7);
    useMapStore.getState().setBbox([42.1, -8.9, 42.4, -8.5]);
    useMapStore.getState().setCenter([43.36, -8.41], 12);

    const raw = localStorage.getItem('aparkeo-map-viewport');
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw as string) as {
      state: Record<string, unknown>;
    };
    expect(persisted.state.center).toEqual([43.36, -8.41]);
    expect(persisted.state.zoom).toBe(12);
    // Lo efímero NO se persiste: selección, ubicación GPS ni bbox.
    expect(persisted.state.selectedSpotId).toBeUndefined();
    expect(persisted.state.userLocation).toBeUndefined();
    expect(persisted.state.bbox).toBeUndefined();
  });

  it('la selección de plaza no toca el viewport persistido', () => {
    useMapStore.getState().setCenter([42.24, -8.72], 15);
    useMapStore.getState().setSelectedSpot(42);

    const persisted = JSON.parse(localStorage.getItem('aparkeo-map-viewport') as string) as {
      state: { center: [number, number]; zoom: number };
    };
    expect(persisted.state.center).toEqual([42.24, -8.72]);
    expect(persisted.state.zoom).toBe(15);
  });
});
