import { cookies } from 'next/headers';
import { getDictionary, LANG_COOKIE, resolveLocale, type Dictionary, type Locale } from './index';

/**
 * Lectura del idioma en el servidor (SSR): la cookie `lang` decide el
 * diccionario; sin cookie (o valor desconocido) se sirve español.
 *
 * Ojo: `cookies()` marca la ruta como dinámica. Es la consecuencia aceptada
 * del patrón elegido (i18n sin segmento [locale]): toda la app se renderiza
 * en servidor por petición, que es justo lo que permite que el mismo HTML
 * SSR llegue ya traducido.
 */
export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  return resolveLocale(store.get(LANG_COOKIE)?.value);
}

export async function getServerDictionary(): Promise<Dictionary> {
  return getDictionary(await getServerLocale());
}
