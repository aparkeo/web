'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import {
  SESSION_ANSWERED_KEY,
  SESSION_VISIT_COUNTED_KEY,
  VISITS_STORAGE_KEY,
  decideAfterOutcome,
  isDismissedRecently,
  isIOSDevice,
  isInstalledStandalone,
  nextVisitCount,
  shouldShowInstallPrompt,
  writeDismissedAt,
  writeVisitCount,
  readDismissedAt,
  type BeforeInstallPromptEvent,
} from '@/lib/installPrompt';
import { INSTALL_ENGAGEMENT_MS } from '@/lib/installPrompt';

/**
 * Prompt de instalación PWA («Añadir a pantalla de inicio»).
 *
 * - Captura `beforeinstallprompt` y lo guarda: nunca se muestra nada en la
 *   primera carga; el banner automático exige engagement (2.ª visita o 30 s).
 * - «Ahora no» silencia el banner 14 días (localStorage). La X lo oculta solo
 *   durante la sesión. Aceptar/rechazar el prompt nativo también silencia la
 *   sesión entera.
 * - Si la app ya está instalada (display-mode standalone, flag de Safari o
 *   evento `appinstalled`) no se muestra nada.
 * - iOS/Safari no dispara `beforeinstallprompt`: se detecta (incluido iPadOS
 *   que se anuncia como Mac) y el banner muestra las instrucciones manuales.
 * - El menú de usuario puede abrir el mismo flujo en cualquier momento a
 *   través del contexto (`useInstallMenu`).
 */

interface InstallMenuApi {
  /** true si hay algo que ofrecer (prompt nativo listo o instrucciones iOS). */
  canInstall: boolean;
  isInstalled: boolean;
  /** Abre el flujo: prompt nativo si existe, si no el banner con instrucciones. */
  openInstall: () => void;
}

const InstallMenuContext = createContext<InstallMenuApi | null>(null);

/** Punto de entrada para el Navbar (entrada permanente «Instalar app»). */
export function useInstallMenu(): InstallMenuApi {
  const ctx = useContext(InstallMenuContext);
  if (!ctx) {
    // Fuera del provider (tests, storybook): no-op seguro.
    return { canInstall: false, isInstalled: false, openInstall: () => {} };
  }
  return ctx;
}

export function InstallPromptProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [visits, setVisits] = useState(1);
  const [engaged, setEngaged] = useState(false);
  const [dismissedRecently, setDismissedRecently] = useState(true); // prudente: oculto hasta comprobar
  const [sessionAnswered, setSessionAnswered] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [sessionHidden, setSessionHidden] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // --- Detección de plataforma y estado inicial --------------------------
    setIsIos(isIOSDevice(navigator.userAgent, navigator.maxTouchPoints));

    const media = window.matchMedia('(display-mode: standalone)');
    const navStandalone = (navigator as { standalone?: boolean }).standalone === true;
    setInstalled(isInstalledStandalone(media.matches, navStandalone));
    const onMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) setInstalled(true);
    };
    media.addEventListener('change', onMediaChange);

    // --- Contador de visitas: una por sesión de navegador ------------------
    try {
      if (!sessionStorage.getItem(SESSION_VISIT_COUNTED_KEY)) {
        const count = nextVisitCount(localStorage.getItem(VISITS_STORAGE_KEY));
        writeVisitCount(localStorage, count);
        sessionStorage.setItem(SESSION_VISIT_COUNTED_KEY, '1');
        setVisits(count);
      } else {
        const raw = localStorage.getItem(VISITS_STORAGE_KEY);
        const count = Number.parseInt(raw ?? '', 10);
        setVisits(Number.isFinite(count) && count > 0 ? count : 1);
      }
      setDismissedRecently(isDismissedRecently(readDismissedAt(localStorage), Date.now()));
      setSessionAnswered(sessionStorage.getItem(SESSION_ANSWERED_KEY) === '1');
    } catch {
      // Almacenamiento no disponible (modo privado estricto): banner sesión-only.
      setDismissedRecently(false);
    }

    // --- Puerta de engagement: temporizador de 30 s ------------------------
    const timer = window.setTimeout(() => setEngaged(true), INSTALL_ENGAGEMENT_MS);

    // --- Eventos del ciclo de vida de instalación --------------------------
    const onBeforeInstall = (event: Event) => {
      event.preventDefault(); // no mostramos nada de inmediato; lo guardamos
      const bip = event as BeforeInstallPromptEvent;
      deferredRef.current = bip;
      setDeferredPrompt(bip);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setManualOpen(false);
      deferredRef.current = null;
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.clearTimeout(timer);
      media.removeEventListener('change', onMediaChange);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const canPrompt = deferredPrompt !== null || isIos;

  const markSessionAnswered = useCallback(() => {
    setSessionAnswered(true);
    try {
      sessionStorage.setItem(SESSION_ANSWERED_KEY, '1');
    } catch {
      // Sin sessionStorage: el estado en memoria ya silencia la sesión.
    }
  }, []);

  /** Lanza el prompt nativo guardado y aplica el outcome. */
  const install = useCallback(async () => {
    const bip = deferredRef.current;
    if (!bip) return;
    try {
      await bip.prompt();
      const { outcome } = await bip.userChoice;
      const decision = decideAfterOutcome(outcome);
      if (decision.suppressForSession) markSessionAnswered();
      if (decision.hideBanner) {
        setSessionHidden(true);
        setManualOpen(false);
      }
    } catch {
      // Si el navegador rechaza prompt(), no insistimos en esta sesión.
      markSessionAnswered();
      setSessionHidden(true);
      setManualOpen(false);
    } finally {
      deferredRef.current = null;
      setDeferredPrompt(null);
    }
  }, [markSessionAnswered]);

  /** «Ahora no»: silencio persistente de 14 días. */
  const dismiss = useCallback(() => {
    try {
      writeDismissedAt(localStorage, Date.now());
    } catch {
      // Sin localStorage: al menos queda oculto en memoria.
    }
    setDismissedRecently(true);
    setManualOpen(false);
  }, []);

  /** X: oculta solo durante la sesión actual. */
  const hideForSession = useCallback(() => {
    setSessionHidden(true);
    setManualOpen(false);
  }, []);

  const openInstall = useCallback(() => {
    if (installed) return;
    if (deferredRef.current) {
      void install();
      return;
    }
    // Sin prompt nativo (iOS): mostrar el banner con instrucciones manuales.
    setSessionHidden(false);
    setManualOpen(true);
  }, [installed, install]);

  const menuApi = useMemo<InstallMenuApi>(
    () => ({ canInstall: !installed && canPrompt, isInstalled: installed, openInstall }),
    [installed, canPrompt, openInstall],
  );

  const autoVisible =
    canPrompt &&
    !sessionHidden &&
    shouldShowInstallPrompt({
      isStandalone: installed,
      dismissedRecently,
      answeredThisSession: sessionAnswered,
      visits,
      engagedMs: engaged ? INSTALL_ENGAGEMENT_MS : 0,
    });

  const visible = canPrompt && !installed && !sessionHidden && (manualOpen || autoVisible);

  return (
    <InstallMenuContext.Provider value={menuApi}>
      {children}
      {visible ? (
        <InstallPromptBanner
          variant={deferredPrompt ? 'native' : 'ios'}
          onInstall={() => void install()}
          onDismiss={dismiss}
          onClose={hideForSession}
        />
      ) : null}
    </InstallMenuContext.Provider>
  );
}

/* --------------------------------------------------------------------------
 * Banner (presentacional)
 * ------------------------------------------------------------------------ */

interface BannerProps {
  variant: 'native' | 'ios';
  onInstall: () => void;
  onDismiss: () => void;
  onClose: () => void;
}

function InstallPromptBanner({ variant, onInstall, onDismiss, onClose }: BannerProps) {
  return (
    <div
      role="region"
      aria-label="Instalar la aplicación MinusVigo"
      className="home-fade-up fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:right-6 sm:w-[22rem]"
    >
      <div className="relative rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar aviso de instalación"
          className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- icono local estático */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-xl shadow-sm"
          />
          <div className="min-w-0 pr-8">
            <p className="text-sm font-bold leading-tight">Instala MinusVigo</p>
            {variant === 'native' ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Añádela a tu pantalla de inicio y encuentra plazas PMR con un toque, incluso sin
                cobertura.
              </p>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground">
                <p>En tu iPhone o iPad se instala en dos pasos:</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                  <li className="flex flex-wrap items-center gap-1">
                    Pulsa
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                      <Share className="h-3.5 w-3.5" aria-hidden="true" />
                      Compartir
                    </span>
                    en Safari
                  </li>
                  <li>Elige «Añadir a pantalla de inicio»</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {variant === 'native' ? (
            <button
              type="button"
              onClick={onInstall}
              className="btn-cta flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Instalar app
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className={`flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${
              variant === 'native' ? '' : 'flex-1'
            }`}
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
