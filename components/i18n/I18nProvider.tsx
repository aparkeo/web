'use client';

import { createContext, useContext } from 'react';
import {
  DEFAULT_LOCALE,
  getDictionary,
  type Dictionary,
  type Locale,
} from '@/lib/i18n';

/**
 * Contexto cliente i18n. El root layout (server) lee la cookie `lang` y pasa
 * `{ locale, dict }` como props — los diccionarios son datos puros (solo
 * strings), así que cruzan la frontera server→cliente sin problema y el
 * cliente queda siempre sincronizado con lo que sirvió el SSR. Cambiar de
 * idioma = escribir la cookie + `router.refresh()` (LocaleSwitcher).
 *
 * Fallback sin provider: español. Permite renderizar componentes aislados en
 * tests/storybook sin envolverlos en el provider (mismo patrón que
 * `useInstallMenu`).
 */
interface I18nContextValue {
  locale: Locale;
  t: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  return <I18nContext.Provider value={{ locale, t: dict }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return { locale: DEFAULT_LOCALE, t: getDictionary(DEFAULT_LOCALE) };
  }
  return ctx;
}

/** Atajo al diccionario activo: `const t = useT(); t.nav.map`. */
export function useT(): Dictionary {
  return useI18n().t;
}
