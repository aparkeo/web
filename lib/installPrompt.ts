/**
 * Lógica pura del prompt de instalación PWA («Añadir a pantalla de inicio»).
 *
 * Todo lo que necesita navegador real (listeners, matchMedia, timers) vive en
 * components/InstallPrompt.tsx; aquí solo hay decisiones testeables:
 * detección de iOS, puerta de engagement, dismiss persistente y outcome del
 * prompt nativo.
 */

/* --------------------------------------------------------------------------
 * Constantes de UX (reglas acordadas)
 * ------------------------------------------------------------------------ */

/** Días que «Ahora no» silencia el banner. */
export const INSTALL_DISMISS_DAYS = 14;

/** El banner puede aparecer a partir de la 2.ª visita… */
export const INSTALL_MIN_VISITS = 2;

/** …o tras este tiempo en la app (lo primero que ocurra). */
export const INSTALL_ENGAGEMENT_MS = 30_000;

/** Tras aceptar o rechazar el prompt nativo no se insiste en la sesión. */
export const SESSION_ANSWERED_KEY = 'mv-install-answered';

/** Marca de que la visita actual ya se contó (sessionStorage). */
export const SESSION_VISIT_COUNTED_KEY = 'mv-install-visit-counted';

/** Timestamp del último «Ahora no» (localStorage). */
export const DISMISS_STORAGE_KEY = 'mv-install-dismissed-at';

/** Contador de visitas (localStorage). */
export const VISITS_STORAGE_KEY = 'mv-install-visits';

/** Subconjunto de Storage que usan los helpers (facilita mocks en tests). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/* --------------------------------------------------------------------------
 * Tipos del evento nativo (no está en lib.dom de TypeScript)
 * ------------------------------------------------------------------------ */

export type InstallOutcome = 'accepted' | 'dismissed';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
  prompt(): Promise<void>;
}

/* --------------------------------------------------------------------------
 * Detección de plataforma
 * ------------------------------------------------------------------------ */

/**
 * ¿El dispositivo es iOS/iPadOS? Safari en iOS no dispara `beforeinstallprompt`,
 * así que hay que mostrar instrucciones manuales. iPadOS 13+ se anuncia como
 * «Macintosh» en el user-agent; se detecta por los puntos táctiles.
 */
export function isIOSDevice(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return true;
  // iPadOS en modo «desktop»: UA de Mac pero pantalla táctil real.
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/**
 * ¿La app ya está instalada y abierta en modo standalone?
 * `mediaMatches` es el resultado de matchMedia('(display-mode: standalone)')
 * y `navigatorStandalone` el flag propietario de Safari iOS.
 */
export function isInstalledStandalone(
  mediaMatches: boolean,
  navigatorStandalone: boolean,
): boolean {
  return mediaMatches || navigatorStandalone;
}

/* --------------------------------------------------------------------------
 * Dismiss persistente («Ahora no» → 14 días de silencio)
 * ------------------------------------------------------------------------ */

export function readDismissedAt(storage: StorageLike): number | null {
  const raw = storage.getItem(DISMISS_STORAGE_KEY);
  if (raw == null) return null;
  const ts = Number.parseInt(raw, 10);
  return Number.isFinite(ts) ? ts : null;
}

export function writeDismissedAt(storage: StorageLike, now: number): void {
  storage.setItem(DISMISS_STORAGE_KEY, String(now));
}

/** true si el último «Ahora no» fue hace menos de INSTALL_DISMISS_DAYS. */
export function isDismissedRecently(dismissedAt: number | null, now: number): boolean {
  if (dismissedAt == null) return false;
  return now - dismissedAt < INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

/* --------------------------------------------------------------------------
 * Contador de visitas (una por sesión de navegador)
 * ------------------------------------------------------------------------ */

/** Siguiente valor del contador a partir de lo guardado (robusto a basura). */
export function nextVisitCount(raw: string | null): number {
  const current = Number.parseInt(raw ?? '', 10);
  return (Number.isFinite(current) && current >= 0 ? current : 0) + 1;
}

export function readVisitCount(storage: StorageLike): number {
  const raw = storage.getItem(VISITS_STORAGE_KEY);
  const current = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(current) && current >= 0 ? current : 0;
}

export function writeVisitCount(storage: StorageLike, count: number): void {
  storage.setItem(VISITS_STORAGE_KEY, String(count));
}

/* --------------------------------------------------------------------------
 * Puerta de engagement: cuándo puede aparecer el banner automáticamente
 * ------------------------------------------------------------------------ */

export interface InstallGateInput {
  /** Ya instalada (display-mode standalone o flag de iOS). */
  isStandalone: boolean;
  /** «Ahora no» pulsado hace menos de 14 días. */
  dismissedRecently: boolean;
  /** El prompt nativo ya fue respondido en esta sesión. */
  answeredThisSession: boolean;
  /** Visitas acumuladas (una por sesión de navegador). */
  visits: number;
  /** Milisegundos que lleva la app abierta en esta visita. */
  engagedMs: number;
}

/**
 * El banner automático solo aparece con engagement real: a partir de la 2.ª
 * visita o tras ~30 s en la app — nunca en la primera carga — y nunca si la
 * app ya está instalada, si el usuario lo descartó hace <14 días o si ya
 * respondió al prompt nativo en esta sesión.
 */
export function shouldShowInstallPrompt(gate: InstallGateInput): boolean {
  if (gate.isStandalone) return false;
  if (gate.dismissedRecently) return false;
  if (gate.answeredThisSession) return false;
  return gate.visits >= INSTALL_MIN_VISITS || gate.engagedMs >= INSTALL_ENGAGEMENT_MS;
}

/* --------------------------------------------------------------------------
 * Outcome del prompt nativo
 * ------------------------------------------------------------------------ */

export interface OutcomeDecision {
  /** Ocultar el banner siempre (no insistir en la sesión). */
  hideBanner: boolean;
  /** Marcar la sesión como respondida en sessionStorage. */
  suppressForSession: boolean;
}

/**
 * Tanto «accepted» como «dismissed» cierran el banner y silencian el prompt
 * automático durante el resto de la sesión. Si el usuario aceptó, además la
 * app quedará instalada y `appinstalled` la marcará como tal.
 */
export function decideAfterOutcome(outcome: InstallOutcome): OutcomeDecision {
  // «accepted» instala la app; «dismissed» es un «no» explícito del usuario.
  // Ambos cierran el ciclo: no se insiste en lo que queda de sesión.
  void outcome;
  return { hideBanner: true, suppressForSession: true };
}
