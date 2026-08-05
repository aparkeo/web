import { beforeEach, describe, expect, it } from 'vitest';
import {
  DISMISS_STORAGE_KEY,
  INSTALL_DISMISS_DAYS,
  INSTALL_ENGAGEMENT_MS,
  INSTALL_MIN_VISITS,
  VISITS_STORAGE_KEY,
  decideAfterOutcome,
  isDismissedRecently,
  isIOSDevice,
  isInstalledStandalone,
  nextVisitCount,
  readDismissedAt,
  readVisitCount,
  shouldShowInstallPrompt,
  writeDismissedAt,
  writeVisitCount,
  type StorageLike,
} from '@/lib/installPrompt';

// User-agents representativos.
const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
// iPadOS 13+ en modo «desktop»: se anuncia como Macintosh.
const UA_IPADOS_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const UA_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000; // timestamp fijo arbitrario

/** StorageLike en memoria (misma interfaz que localStorage). */
function makeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
  };
}

describe('isIOSDevice', () => {
  it('detecta iPhone y iPad por user-agent', () => {
    expect(isIOSDevice(UA_IPHONE, 5)).toBe(true);
    expect(isIOSDevice(UA_IPAD, 5)).toBe(true);
  });

  it('detecta iPadOS que se hace pasar por Mac (Macintosh + pantalla táctil)', () => {
    expect(isIOSDevice(UA_IPADOS_DESKTOP, 5)).toBe(true);
  });

  it('no confunde un Mac de escritorio real (sin puntos táctiles)', () => {
    expect(isIOSDevice(UA_MAC, 0)).toBe(false);
    expect(isIOSDevice(UA_IPADOS_DESKTOP, 0)).toBe(false);
    expect(isIOSDevice(UA_MAC, 1)).toBe(false);
  });

  it('no detecta Android como iOS', () => {
    expect(isIOSDevice(UA_ANDROID, 5)).toBe(false);
  });
});

describe('isInstalledStandalone', () => {
  it('true si matchMedia(display-mode: standalone) coincide', () => {
    expect(isInstalledStandalone(true, false)).toBe(true);
  });

  it('true con el flag propietario de Safari iOS', () => {
    expect(isInstalledStandalone(false, true)).toBe(true);
  });

  it('false en navegador normal', () => {
    expect(isInstalledStandalone(false, false)).toBe(false);
  });
});

describe('dismiss persistente (14 días)', () => {
  it('sin dismiss previo no silencia', () => {
    expect(isDismissedRecently(null, NOW)).toBe(false);
  });

  it('un dismiss de hace 13 días sigue silenciando', () => {
    expect(isDismissedRecently(NOW - 13 * DAY_MS, NOW)).toBe(true);
  });

  it('un dismiss de hace 15 días ya no silencia', () => {
    expect(isDismissedRecently(NOW - 15 * DAY_MS, NOW)).toBe(false);
  });

  it(`el límite exacto es ${INSTALL_DISMISS_DAYS} días`, () => {
    expect(isDismissedRecently(NOW - INSTALL_DISMISS_DAYS * DAY_MS + 1, NOW)).toBe(true);
    expect(isDismissedRecently(NOW - INSTALL_DISMISS_DAYS * DAY_MS, NOW)).toBe(false);
  });

  it('writeDismissedAt + readDismissedAt hacen roundtrip en el storage', () => {
    const storage = makeStorage();
    writeDismissedAt(storage, NOW);
    expect(storage.data[DISMISS_STORAGE_KEY]).toBe(String(NOW));
    expect(readDismissedAt(storage)).toBe(NOW);
  });

  it('readDismissedAt tolera valores ausentes o corruptos', () => {
    expect(readDismissedAt(makeStorage())).toBeNull();
    expect(readDismissedAt(makeStorage({ [DISMISS_STORAGE_KEY]: 'no-es-numero' }))).toBeNull();
  });
});

describe('contador de visitas', () => {
  it('la primera visita cuenta 1 y escala en siguientes sesiones', () => {
    expect(nextVisitCount(null)).toBe(1);
    expect(nextVisitCount('1')).toBe(2);
    expect(nextVisitCount('7')).toBe(8);
  });

  it('valores corruptos o negativos reinician a 1', () => {
    expect(nextVisitCount('basura')).toBe(1);
    expect(nextVisitCount('-3')).toBe(1);
  });

  it('writeVisitCount + readVisitCount hacen roundtrip', () => {
    const storage = makeStorage();
    writeVisitCount(storage, 4);
    expect(storage.data[VISITS_STORAGE_KEY]).toBe('4');
    expect(readVisitCount(storage)).toBe(4);
    expect(readVisitCount(makeStorage())).toBe(0);
  });
});

describe('shouldShowInstallPrompt (puerta de engagement)', () => {
  const base = {
    isStandalone: false,
    dismissedRecently: false,
    answeredThisSession: false,
    visits: 1,
    engagedMs: 0,
  };

  it('nunca en la primera carga (1.ª visita, recién abierta)', () => {
    expect(shouldShowInstallPrompt(base)).toBe(false);
  });

  it(`aparece a partir de la ${INSTALL_MIN_VISITS}.ª visita`, () => {
    expect(shouldShowInstallPrompt({ ...base, visits: INSTALL_MIN_VISITS })).toBe(true);
    expect(shouldShowInstallPrompt({ ...base, visits: INSTALL_MIN_VISITS - 1 })).toBe(false);
  });

  it(`aparece tras ${INSTALL_ENGAGEMENT_MS / 1000} s en la app aunque sea la 1.ª visita`, () => {
    expect(shouldShowInstallPrompt({ ...base, engagedMs: INSTALL_ENGAGEMENT_MS })).toBe(true);
    expect(shouldShowInstallPrompt({ ...base, engagedMs: INSTALL_ENGAGEMENT_MS - 1 })).toBe(false);
  });

  it('no aparece si la app ya está instalada', () => {
    expect(shouldShowInstallPrompt({ ...base, isStandalone: true, visits: 9 })).toBe(false);
  });

  it('no aparece si el usuario lo descartó hace menos de 14 días', () => {
    expect(shouldShowInstallPrompt({ ...base, dismissedRecently: true, visits: 9 })).toBe(false);
  });

  it('no aparece si ya respondió al prompt nativo en esta sesión', () => {
    expect(shouldShowInstallPrompt({ ...base, answeredThisSession: true, visits: 9 })).toBe(false);
  });
});

describe('flujo beforeinstallprompt → prompt() → outcome', () => {
  /** Simula el evento nativo del navegador con un outcome decidido. */
  function makeBeforeInstallPromptEvent(outcome: 'accepted' | 'dismissed') {
    const calls = { prompt: 0 };
    return {
      calls,
      event: {
        platforms: ['web'],
        prompt: async () => {
          calls.prompt += 1;
        },
        userChoice: Promise.resolve({ outcome, platform: 'web' }),
      },
    };
  }

  it('tras «accepted» se oculta el banner y se silencia la sesión', async () => {
    const { calls, event } = makeBeforeInstallPromptEvent('accepted');
    await event.prompt();
    const { outcome } = await event.userChoice;

    expect(calls.prompt).toBe(1);
    expect(decideAfterOutcome(outcome)).toEqual({ hideBanner: true, suppressForSession: true });
  });

  it('tras «dismissed» tampoco se insiste en la sesión', async () => {
    const { event } = makeBeforeInstallPromptEvent('dismissed');
    await event.prompt();
    const { outcome } = await event.userChoice;

    expect(decideAfterOutcome(outcome)).toEqual({ hideBanner: true, suppressForSession: true });
  });

  it('la puerta bloquea el banner tras marcar la sesión como respondida', () => {
    // Lo que hace el componente tras cualquier outcome: answeredThisSession = true.
    expect(
      shouldShowInstallPrompt({
        isStandalone: false,
        dismissedRecently: false,
        answeredThisSession: true,
        visits: 10,
        engagedMs: INSTALL_ENGAGEMENT_MS * 10,
      }),
    ).toBe(false);
  });
});

describe('integración con localStorage de jsdom', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('el dismiss escrito persiste y bloquea la puerta durante 14 días', () => {
    writeDismissedAt(localStorage, NOW);
    const dismissed = isDismissedRecently(readDismissedAt(localStorage), NOW + DAY_MS);
    expect(
      shouldShowInstallPrompt({
        isStandalone: false,
        dismissedRecently: dismissed,
        answeredThisSession: false,
        visits: 5,
        engagedMs: 0,
      }),
    ).toBe(false);
  });

  it('pasados 14 días el banner puede volver con engagement', () => {
    writeDismissedAt(localStorage, NOW);
    const dismissed = isDismissedRecently(readDismissedAt(localStorage), NOW + 15 * DAY_MS);
    expect(
      shouldShowInstallPrompt({
        isStandalone: false,
        dismissedRecently: dismissed,
        answeredThisSession: false,
        visits: 5,
        engagedMs: 0,
      }),
    ).toBe(true);
  });
});
