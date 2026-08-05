import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  LANG_COOKIE,
  LOCALES,
  getDictionary,
  resolveLocale,
} from '@/lib/i18n';
import { es } from '@/lib/i18n/es';
import { gl } from '@/lib/i18n/gl';
import { fmt } from '@/lib/i18n/format';

/**
 * Recorre recursivamente las claves de un diccionario y devuelve sus rutas
 * («nav.home», «tour.steps.welcome», …) junto al tipo de cada valor hoja.
 */
function leafEntries(obj: unknown, prefix = ''): [string, string][] {
  if (obj === null || typeof obj !== 'object') return [[prefix, typeof obj]];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    leafEntries(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe('i18n — diccionarios ES/GL', () => {
  it('locales y constantes son coherentes', () => {
    expect(LOCALES).toEqual(['es', 'gl']);
    expect(DEFAULT_LOCALE).toBe('es');
    expect(LANG_COOKIE).toBe('lang');
  });

  it('gl tiene exactamente las mismas claves que es y todas son strings', () => {
    const esLeaves = leafEntries(es);
    const glLeaves = leafEntries(gl);

    // Paridad de rutas: mismas claves en el mismo orden de declaración.
    expect(glLeaves.map(([path]) => path)).toEqual(esLeaves.map(([path]) => path));

    // Todas las hojas son strings no vacíos en ambos diccionarios.
    for (const [path, type] of esLeaves) {
      expect(type, `es.${path} debe ser string`).toBe('string');
    }
    for (const [path, type] of glLeaves) {
      expect(type, `gl.${path} debe ser string`).toBe('string');
    }
    for (const [path] of glLeaves) {
      const value = path.split('.').reduce<unknown>((acc, key) => {
        return (acc as Record<string, unknown>)[key];
      }, gl);
      expect((value as string).length, `gl.${path} no debe estar vacío`).toBeGreaterThan(0);
    }
  });

  it('los placeholders {…} coinciden entre es y gl', () => {
    const placeholderRe = /\{(\w+)\}/g;
    const esLeaves = leafEntries(es);
    const glMap = new Map(leafEntries(gl).map(([path]) => [path, true]));

    for (const [path] of esLeaves) {
      expect(glMap.has(path)).toBe(true);
      const esValue = path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], es) as string;
      const glValue = path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], gl) as string;
      const esPh = [...esValue.matchAll(placeholderRe)].map((m) => m[1]).sort();
      const glPh = [...glValue.matchAll(placeholderRe)].map((m) => m[1]).sort();
      expect(glPh, `placeholders de ${path}`).toEqual(esPh);
    }
  });
});

describe('resolveLocale', () => {
  it('resuelve valores válidos y cae a español con cualquier otra cosa', () => {
    expect(resolveLocale('es')).toBe('es');
    expect(resolveLocale('gl')).toBe('gl');
    expect(resolveLocale(undefined)).toBe('es');
    expect(resolveLocale(null)).toBe('es');
    expect(resolveLocale('')).toBe('es');
    expect(resolveLocale('fr')).toBe('es');
    expect(resolveLocale('GL')).toBe('es');
    expect(resolveLocale('es-ES')).toBe('es');
  });
});

describe('getDictionary', () => {
  it('devuelve el diccionario del locale pedido', () => {
    expect(getDictionary('es')).toBe(es);
    expect(getDictionary('gl')).toBe(gl);
  });
});

describe('fmt', () => {
  it('interpola placeholders string y number', () => {
    expect(fmt('~{n} min a pie', { n: 5 })).toBe('~5 min a pie');
    expect(fmt('Última actualización: {date}.', { date: '5 de agosto de 2026' })).toBe(
      'Última actualización: 5 de agosto de 2026.',
    );
  });

  it('deja literales los placeholders sin valor y no rompe con texto sin placeholders', () => {
    expect(fmt('Hola {name}', {})).toBe('Hola {name}');
    expect(fmt('sin placeholders', { n: 1 })).toBe('sin placeholders');
  });
});
