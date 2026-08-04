import { beforeEach, describe, expect, it } from 'vitest';
import { useBaseLayerStore } from '@/store/useBaseLayerStore';

describe('useBaseLayerStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useBaseLayerStore.setState({ baseLayer: 'map' });
  });

  it('empieza en "map" por defecto', () => {
    expect(useBaseLayerStore.getState().baseLayer).toBe('map');
  });

  it('cambia a "satellite"', () => {
    useBaseLayerStore.getState().setBaseLayer('satellite');
    expect(useBaseLayerStore.getState().baseLayer).toBe('satellite');
  });

  it('persiste la elección en localStorage', () => {
    useBaseLayerStore.getState().setBaseLayer('satellite');

    const raw = localStorage.getItem('minusvigo-baselayer');
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw as string) as { state: { baseLayer?: string } };
    expect(persisted.state.baseLayer).toBe('satellite');
  });

  it('vuelve a "map" y actualiza la persistencia', () => {
    useBaseLayerStore.getState().setBaseLayer('satellite');
    useBaseLayerStore.getState().setBaseLayer('map');

    expect(useBaseLayerStore.getState().baseLayer).toBe('map');
    const persisted = JSON.parse(localStorage.getItem('minusvigo-baselayer') as string) as {
      state: { baseLayer?: string };
    };
    expect(persisted.state.baseLayer).toBe('map');
  });
});
