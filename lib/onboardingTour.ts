/**
 * Lógica pura del tour de onboarding de primera visita.
 *
 * Todo lo que necesita navegador real (listeners, foco, getBoundingClientRect,
 * localStorage del window) vive en components/OnboardingTour.tsx; aquí solo
 * hay decisiones testeables: persistencia del flag, pasos del tour y cálculo
 * de posiciones (spotlight y tooltip) a partir de rectángulos planos.
 */

/** Flag localStorage: el tour automático solo se muestra si NO existe. */
export const TOUR_DONE_STORAGE_KEY = 'minusvigo-onboarding-done';

/** Pequeña pausa antes de auto-lanzar el tour, para que la página pinte. */
export const TOUR_AUTO_START_DELAY_MS = 900;

/** Subconjunto de Storage que usan los helpers (facilita mocks en tests). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type TourStepId = 'map-status' | 'report' | 'notifications' | 'cta';

export interface TourStep {
  id: TourStepId;
  /**
   * Selector CSS del elemento a resaltar con el spotlight. Si es null —o el
   * elemento no existe en pantalla (p. ej. la campana sin sesión o la
   * navegación desktop en móvil)— el paso degrada a tooltip centrado.
   */
  targetSelector: string | null;
  title: string;
  body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'map-status',
    targetSelector: '[data-tour="map"]',
    title: 'El mapa, de un vistazo',
    body: 'Cada punto es una plaza PMR de Vigo: verde si está libre, rojo si está ocupada y gris si aún no hay datos. Toca un punto para ver la calle, la distancia y cómo llegar.',
  },
  {
    id: 'report',
    targetSelector: '[data-tour="report"]',
    title: '¿Ves una plaza? Cuéntalo',
    body: 'Desde «Reportar» (o entrando en el detalle de una plaza) dinos si está libre u ocupada. Si añades tu ubicación GPS tu reporte pesa más y toda la comunidad PMR acierta mejor.',
  },
  {
    id: 'notifications',
    targetSelector: '[data-tour="notifications"]',
    title: 'Activa los avisos',
    body: 'Marca tus plazas habituales con ★ y activa los avisos desde la campana: te avisaremos al momento cuando una quede libre. Sin spam, solo lo que te interesa.',
  },
  {
    id: 'cta',
    targetSelector: null,
    title: 'Listo, a aparcar',
    body: 'Eso es todo. Explora el mapa y encuentra tu plaza. Si algún día quieres repasarlo, tienes el enlace «Ver tour» en el pie de página.',
  },
];

/* --------------------------------------------------------------------------
 * Persistencia del flag (robusta: cualquier valor distinto de '1' cuenta
 * como «no hecho», así basura en storage nunca oculta el tour para siempre)
 * ------------------------------------------------------------------------ */

export function readTourDone(storage: StorageLike): boolean {
  return storage.getItem(TOUR_DONE_STORAGE_KEY) === '1';
}

export function writeTourDone(storage: StorageLike): void {
  storage.setItem(TOUR_DONE_STORAGE_KEY, '1');
}

/**
 * El tour automático solo se lanza en la home o en el mapa (las caras
 * públicas principales); nunca en login, registro, admin, etc.
 */
export function canAutoStartOnPath(pathname: string | null): boolean {
  return pathname === '/' || pathname === '/map';
}

/* --------------------------------------------------------------------------
 * Geometría: spotlight y posición del tooltip (rectángulos planos, sin DOM)
 * ------------------------------------------------------------------------ */

export interface TourRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TourSize {
  width: number;
  height: number;
}

export type TooltipPlacement = 'top' | 'bottom' | 'center';

export interface TooltipLayout {
  top: number;
  left: number;
  placement: TooltipPlacement;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Rectángulo del spotlight: el target expandido con un padding y recortado
 * al viewport (un elemento pegado al borde nunca produce coordenadas
 * negativas ni se sale de la pantalla).
 */
export function computeSpotlightRect(
  target: TourRect,
  viewport: TourSize,
  padding = 10,
): TourRect {
  const top = clamp(target.top - padding, 0, viewport.height);
  const left = clamp(target.left - padding, 0, viewport.width);
  const right = clamp(target.left + target.width + padding, 0, viewport.width);
  const bottom = clamp(target.top + target.height + padding, 0, viewport.height);
  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/**
 * Posición del tooltip respecto al target: debajo si cabe, encima si no, y
 * centrado en el viewport como último recurso (o cuando el paso no tiene
 * target visible). Horizontalmente se centra sobre el target y se sujeta a
 * los márgenes de la pantalla, así nunca se corta en móvil.
 */
export function computeTooltipLayout(
  target: TourRect | null,
  viewport: TourSize,
  tooltip: TourSize,
  gap = 12,
  margin = 12,
): TooltipLayout {
  const centeredTop = clamp((viewport.height - tooltip.height) / 2, margin, viewport.height);
  const centeredLeft = clamp((viewport.width - tooltip.width) / 2, margin, viewport.width);

  if (!target) {
    return { top: centeredTop, left: centeredLeft, placement: 'center' };
  }

  const belowTop = target.top + target.height + gap;
  const aboveTop = target.top - gap - tooltip.height;
  const fitsBelow = belowTop + tooltip.height <= viewport.height - margin;
  const fitsAbove = aboveTop >= margin;

  let top: number;
  let placement: TooltipPlacement;
  if (fitsBelow) {
    top = belowTop;
    placement = 'bottom';
  } else if (fitsAbove) {
    top = aboveTop;
    placement = 'top';
  } else {
    top = centeredTop;
    placement = 'center';
  }

  const left = clamp(
    target.left + target.width / 2 - tooltip.width / 2,
    margin,
    viewport.width - tooltip.width - margin,
  );

  return { top, left, placement };
}
