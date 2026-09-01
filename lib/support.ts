/**
 * Configuración de apoyo al proyecto (Fase 1 de monetización: donaciones +
 * patrocinio local). El núcleo de Aparkeo —mapa y reportes— sigue siendo
 * comunitario y gratuito; esta fase solo financia costes (servidor, base de
 * datos, dominio, tiempo de desarrollo).
 *
 * Contacto institucional y de patrocinio: SUPPORT_CONTACT_EMAIL (real).
 * Donaciones: Ko-fi y PayPal siguen siendo placeholders hasta que exista
 * el perfil; no publicitar /apoyo como canal de cobro hasta sustituirlos.
 * - SUPPORT_KOFI_URL    → perfil real de Ko-fi
 * - SUPPORT_PAYPAL_URL  → enlace real de PayPal.Me (o botón de donación)
 */

/** PLACEHOLDER — sustituir por el perfil real de Ko-fi. */
export const SUPPORT_KOFI_URL = 'https://ko-fi.com/minusvigo';

/** PLACEHOLDER — sustituir por el enlace real de PayPal. */
export const SUPPORT_PAYPAL_URL = 'https://www.paypal.com/paypalme/minusvigo';

/** Buzón público: instituciones, patrocinio y derechos RGPD. */
export const SUPPORT_CONTACT_EMAIL = 'hola@aparkeo.com';

/** Patrocinador local que se muestra en la sección «Con el apoyo de» de /apoyo. */
export interface Sponsor {
  name: string;
  url?: string;
  /** Ruta pública al logo (p. ej. `/sponsors/acme.svg`) o URL absoluta. */
  logo?: string;
}

/**
 * Lista de patrocinadores activos. Vacía por ahora; para dar de alta uno,
 * añadir un objeto aquí (y el logo en `public/sponsors/` si lo hay).
 *
 * Ejemplo:
 *   { name: 'Cafetería Ejemplo', url: 'https://ejemplo.es', logo: '/sponsors/ejemplo.svg' }
 */
export const SPONSORS: Sponsor[] = [];

/** true si hay al menos un patrocinador configurado. */
export function hasSponsors(): boolean {
  return SPONSORS.length > 0;
}
