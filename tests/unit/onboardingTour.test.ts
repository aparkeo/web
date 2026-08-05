import { describe, expect, it } from 'vitest';
import {
  TOUR_DONE_STORAGE_KEY,
  TOUR_STEPS,
  canAutoStartOnPath,
  computeSpotlightRect,
  computeTooltipLayout,
  readTourDone,
  writeTourDone,
  type StorageLike,
} from '@/lib/onboardingTour';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('persistencia del tour', () => {
  it('sin flag, el tour no está hecho', () => {
    expect(readTourDone(fakeStorage())).toBe(false);
  });

  it('basura en storage cuenta como no hecho (nunca oculta el tour para siempre)', () => {
    expect(readTourDone(fakeStorage({ [TOUR_DONE_STORAGE_KEY]: 'patata' }))).toBe(false);
  });

  it('writeTourDone marca el flag y readTourDone lo reconoce', () => {
    const storage = fakeStorage();
    writeTourDone(storage);
    expect(storage.data[TOUR_DONE_STORAGE_KEY]).toBe('1');
    expect(readTourDone(storage)).toBe(true);
  });
});

describe('canAutoStartOnPath', () => {
  it('se auto-lanza en la home y en el mapa', () => {
    expect(canAutoStartOnPath('/')).toBe(true);
    expect(canAutoStartOnPath('/map')).toBe(true);
  });

  it('no se auto-lanza en el resto de páginas', () => {
    expect(canAutoStartOnPath('/login')).toBe(false);
    expect(canAutoStartOnPath('/register')).toBe(false);
    expect(canAutoStartOnPath('/stats')).toBe(false);
    expect(canAutoStartOnPath('/profile')).toBe(false);
    expect(canAutoStartOnPath(null)).toBe(false);
  });
});

describe('computeSpotlightRect', () => {
  const viewport = { width: 400, height: 800 };

  it('expande el target con el padding', () => {
    const rect = computeSpotlightRect({ top: 100, left: 50, width: 200, height: 80 }, viewport, 10);
    expect(rect).toEqual({ top: 90, left: 40, width: 220, height: 100 });
  });

  it('recorta al viewport cuando el target está pegado al borde', () => {
    const rect = computeSpotlightRect({ top: 5, left: 2, width: 100, height: 40 }, viewport, 10);
    expect(rect.top).toBe(0);
    expect(rect.left).toBe(0);
  });

  it('no se sale por abajo ni por la derecha', () => {
    const rect = computeSpotlightRect({ top: 780, left: 395, width: 50, height: 50 }, viewport, 10);
    expect(rect.top + rect.height).toBeLessThanOrEqual(viewport.height);
    expect(rect.left + rect.width).toBeLessThanOrEqual(viewport.width);
  });
});

describe('computeTooltipLayout', () => {
  const viewport = { width: 400, height: 800 };
  const tooltip = { width: 320, height: 200 };

  it('sin target: tooltip centrado en el viewport', () => {
    const layout = computeTooltipLayout(null, viewport, tooltip);
    expect(layout.placement).toBe('center');
    expect(layout.top).toBe(300);
    expect(layout.left).toBe(40);
  });

  it('con hueco debajo: se coloca bajo el target', () => {
    const target = { top: 100, left: 40, width: 320, height: 300 };
    const layout = computeTooltipLayout(target, viewport, tooltip);
    expect(layout.placement).toBe('bottom');
    expect(layout.top).toBe(100 + 300 + 12);
  });

  it('sin hueco debajo pero sí encima: se coloca sobre el target', () => {
    const target = { top: 500, left: 40, width: 320, height: 250 };
    const layout = computeTooltipLayout(target, viewport, tooltip);
    expect(layout.placement).toBe('top');
    expect(layout.top).toBe(500 - 12 - 200);
  });

  it('sin hueco ni encima ni debajo: degrada a centrado', () => {
    const bigTooltip = { width: 320, height: 250 };
    // Debajo: 250+300+12+250 = 812 > 800-12; encima: 250-12-250 < 0.
    const target = { top: 250, left: 40, width: 320, height: 300 };
    const layout = computeTooltipLayout(target, viewport, bigTooltip);
    expect(layout.placement).toBe('center');
    expect(layout.top).toBe((viewport.height - bigTooltip.height) / 2);
  });

  it('se centra horizontalmente sobre el target', () => {
    const target = { top: 100, left: 100, width: 200, height: 100 };
    const layout = computeTooltipLayout(target, viewport, tooltip);
    expect(layout.left).toBe(100 + 100 - 160);
  });

  it('no se corta a la derecha en pantallas estrechas', () => {
    const target = { top: 100, left: 300, width: 100, height: 100 };
    const layout = computeTooltipLayout(target, viewport, tooltip);
    expect(layout.left).toBe(400 - 320 - 12);
  });

  it('no se corta a la izquierda', () => {
    const target = { top: 100, left: 0, width: 40, height: 100 };
    const layout = computeTooltipLayout(target, viewport, tooltip);
    expect(layout.left).toBe(12);
  });
});

describe('TOUR_STEPS', () => {
  it('tiene 4 pasos con ids únicos', () => {
    expect(TOUR_STEPS).toHaveLength(4);
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('todos tienen título y cuerpo en español', () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });

  it('el paso final es el CTA y va sin target (tooltip centrado)', () => {
    const last = TOUR_STEPS[TOUR_STEPS.length - 1];
    expect(last.id).toBe('cta');
    expect(last.targetSelector).toBeNull();
  });

  it('los pasos con spotlight apuntan a atributos data-tour', () => {
    for (const step of TOUR_STEPS) {
      if (step.targetSelector !== null) {
        expect(step.targetSelector).toMatch(/^\[data-tour="[a-z-]+"\]$/);
      }
    }
  });
});
