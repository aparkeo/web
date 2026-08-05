'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  Flag,
  Map as MapIcon,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  TOUR_AUTO_START_DELAY_MS,
  TOUR_STEPS,
  canAutoStartOnPath,
  computeSpotlightRect,
  computeTooltipLayout,
  readTourDone,
  writeTourDone,
  type TourRect,
  type TourSize,
  type TourStepId,
} from '@/lib/onboardingTour';

const STEP_ICONS: Record<TourStepId, LucideIcon> = {
  'map-status': MapIcon,
  report: Flag,
  notifications: BellRing,
  cta: Sparkles,
};

// Estimación inicial del tamaño del tooltip hasta medirlo en el DOM; el
// layout se refina en cuanto hay medida real (sin parpadeo apreciable).
const TOOLTIP_SIZE_FALLBACK: TourSize = { width: 360, height: 230 };

// Color de veladura fijo (teal casi negro, el mismo tinte de las sombras del
// sistema): funciona igual en claro y en oscuro, a diferencia de bg-foreground.
const DIM_COLOR = 'rgb(6 24 21 / 0.6)';

interface OnboardingTourContextValue {
  /** Re-lanza el tour manualmente; navega al mapa si hace falta. */
  startTour: () => void;
  isActive: boolean;
}

const OnboardingTourContext = createContext<OnboardingTourContextValue | null>(null);

export function useOnboardingTour(): OnboardingTourContextValue {
  const ctx = useContext(OnboardingTourContext);
  if (!ctx) {
    throw new Error('useOnboardingTour debe usarse dentro de OnboardingTourProvider');
  }
  return ctx;
}

function readViewport(): TourSize {
  return { width: window.innerWidth, height: window.innerHeight };
}

function toPlainRect(rect: DOMRect): TourRect {
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/** Un target oculto (display:none, colapsado) mide 0×0: se trata como ausente. */
function findTargetRect(selector: string | null): TourRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return toPlainRect(rect);
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function OnboardingTourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  // El relanzamiento manual navega a /map antes de empezar.
  const [pendingStart, setPendingStart] = useState(false);

  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [viewport, setViewport] = useState<TourSize>(TOOLTIP_SIZE_FALLBACK);
  const [tooltipSize, setTooltipSize] = useState<TourSize>(TOOLTIP_SIZE_FALLBACK);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const step = TOUR_STEPS[stepIndex];
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

  const finishTour = useCallback(() => {
    try {
      writeTourDone(window.localStorage);
    } catch {
      // Storage inaccesible (modo privado estricto): el tour se cierra igual;
      // simplemente volverá a aparecer en la próxima visita.
    }
    setActive(false);
    setPendingStart(false);
  }, []);

  const startTour = useCallback(() => {
    setStepIndex(0);
    if (pathname === '/map') {
      setActive(true);
    } else {
      setPendingStart(true);
      router.push('/map');
    }
  }, [pathname, router]);

  const goNext = useCallback(() => {
    if (isLastStep) {
      finishTour();
    } else {
      setStepIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1));
    }
  }, [isLastStep, finishTour]);

  const goPrev = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  // Auto-inicio en la primera visita a la home o al mapa.
  useEffect(() => {
    if (active || pendingStart || !canAutoStartOnPath(pathname)) return;
    let done = true;
    try {
      done = readTourDone(window.localStorage);
    } catch {
      return; // sin storage no hay forma de recordar el flag: no molestamos
    }
    if (done) return;
    const timer = window.setTimeout(() => {
      setStepIndex(0);
      setActive(true);
    }, TOUR_AUTO_START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pathname, active, pendingStart]);

  // Relanzamiento manual desde otra página: arrancar al llegar al mapa.
  useEffect(() => {
    if (pendingStart && pathname === '/map') {
      setPendingStart(false);
      setStepIndex(0);
      setActive(true);
    }
  }, [pendingStart, pathname]);

  // Recolocar spotlight y tooltip al cambiar de paso, redimensionar o hacer scroll.
  useEffect(() => {
    if (!active) return;
    const update = () => {
      setTargetRect(findTargetRect(step.targetSelector));
      setViewport(readViewport());
    };
    update();
    // Segundo pase tras la entrada: fuentes/imágenes pueden mover el target.
    const timer = window.setTimeout(update, 350);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [active, stepIndex, step.targetSelector]);

  // Medida real del tooltip (cambia con el largo del texto de cada paso).
  useLayoutEffect(() => {
    if (!active || !tooltipRef.current) return;
    const el = tooltipRef.current;
    setTooltipSize({ width: el.offsetWidth, height: el.offsetHeight });
  }, [active, stepIndex]);

  // Foco gestionado: al abrir se guarda el foco previo, cada paso mueve el
  // foco al diálogo (los lectores de pantalla anuncian el nuevo contenido) y
  // al cerrar se devuelve el foco a donde estaba.
  useEffect(() => {
    if (active) {
      if (!restoreFocusRef.current) {
        restoreFocusRef.current = document.activeElement as HTMLElement | null;
      }
      tooltipRef.current?.focus();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current.focus();
      restoreFocusRef.current = null;
    }
  }, [active, stepIndex]);

  // Bloqueo de scroll del fondo mientras el tour está abierto (modal).
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);

  // Teclado: Escape cierra, flechas navegan y Tab queda atrapado en el diálogo.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finishTour();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
        return;
      }
      if (event.key === 'Tab' && tooltipRef.current) {
        const focusables = Array.from(
          tooltipRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const index = focusables.indexOf(document.activeElement as HTMLElement);
        // Foco fuera de la lista (p. ej. en el propio diálogo): entra al ciclo.
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (index === -1 || index === focusables.length - 1)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, finishTour, goNext, goPrev]);

  const spotlight = targetRect ? computeSpotlightRect(targetRect, viewport) : null;
  const layout = computeTooltipLayout(targetRect, viewport, tooltipSize);
  const StepIcon = STEP_ICONS[step.id];

  return (
    <OnboardingTourContext.Provider value={{ startTour, isActive: active }}>
      {children}
      {active ? (
        <div className="fixed inset-0 z-[1100]">
          {/* Veladura: spotlight con agujero sobre el target, o capa completa
              cuando el paso no tiene elemento visible en pantalla */}
          {spotlight ? (
            <div
              aria-hidden
              className="absolute rounded-2xl ring-2 ring-accent/80 transition-[top,left,width,height] duration-300 ease-out"
              style={{
                top: spotlight.top,
                left: spotlight.left,
                width: spotlight.width,
                height: spotlight.height,
                boxShadow: `0 0 0 9999px ${DIM_COLOR}`,
              }}
            />
          ) : (
            <div aria-hidden className="absolute inset-0" style={{ backgroundColor: DIM_COLOR }} />
          )}

          <div
            key={step.id}
            ref={tooltipRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-step-title"
            aria-describedby="tour-step-body"
            tabIndex={-1}
            className="home-fade-up fixed w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-border/60 bg-card/90 bg-gradient-to-b from-accent/15 via-transparent to-transparent shadow-elevated backdrop-blur-xl focus:outline-none"
            style={{ top: layout.top, left: layout.left }}
          >
            <div className="flex items-start gap-3 p-5 pb-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <StepIcon className="h-5 w-5" aria-hidden />
              </span>
              <h2 id="tour-step-title" className="pt-1.5 text-base font-extrabold tracking-tight">
                {step.title}
              </h2>
              <button
                type="button"
                onClick={finishTour}
                aria-label="Cerrar el tour"
                className="ml-auto -mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <p id="tour-step-body" className="px-5 text-sm leading-relaxed text-muted-foreground">
              {step.body}
            </p>

            <div className="flex items-center justify-between gap-3 p-5 pt-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5" aria-hidden>
                  {TOUR_STEPS.map((s, i) => (
                    <span
                      key={s.id}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === stepIndex ? 'w-4 bg-primary' : 'w-1.5 bg-border'
                      }`}
                    />
                  ))}
                </span>
                <span className="text-xs text-muted-foreground">
                  Paso {stepIndex + 1} de {TOUR_STEPS.length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={finishTour}
                className="rounded-full text-muted-foreground"
              >
                Saltar
              </Button>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border/60 px-5 py-3.5">
              {stepIndex > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={goPrev}
                  className="min-h-11 gap-1 rounded-full"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden /> Anterior
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={goNext}
                className="btn-cta min-h-11 gap-1 rounded-full px-5 font-bold"
              >
                {isLastStep ? (
                  <>
                    Explorar el mapa <Sparkles className="h-4 w-4" aria-hidden />
                  </>
                ) : (
                  <>
                    Siguiente <ChevronRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </OnboardingTourContext.Provider>
  );
}
