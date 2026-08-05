import { es, type Dictionary } from './es';
import { gl } from './gl';

/**
 * Núcleo i18n (ES por defecto / GL). Sin dependencias: la app no usa segmento
 * de ruta [locale], así que el idioma viaja en la cookie `lang` y los server
 * components eligen diccionario en SSR (ver `lib/i18n/server.ts`); los client
 * components lo reciben por contexto (`components/i18n/I18nProvider.tsx`).
 */

export type Locale = 'es' | 'gl';
export type { Dictionary };
export { es, gl };

export const LOCALES: readonly Locale[] = ['es', 'gl'];
export const DEFAULT_LOCALE: Locale = 'es';

/** Nombre de la cookie de idioma (1 año, SameSite=Lax). */
export const LANG_COOKIE = 'lang';

/**
 * Resuelve el valor crudo de la cookie a un Locale válido. Cualquier valor
 * ausente o desconocido cae al español (default seguro).
 */
export function resolveLocale(value: string | null | undefined): Locale {
  return value === 'gl' ? 'gl' : DEFAULT_LOCALE;
}

export function getDictionary(locale: Locale): Dictionary {
  return locale === 'gl' ? gl : es;
}
