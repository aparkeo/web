import { describe, expect, it } from 'vitest';
import { UTM_VALUE_REGEX, normalizeUtmValue, parseUtmParams, utmSessionKey } from '@/lib/utm';

describe('UTM_VALUE_REGEX', () => {
  it('acepta el formato de los canales de difusión', () => {
    for (const ok of ['cartel', 'instagram', 'twitter', 'facebook', 'whatsapp', 'telegram', 'qr-cartel_2', 'a']) {
      expect(UTM_VALUE_REGEX.test(ok)).toBe(true);
    }
  });

  it('rechaza mayúsculas, espacios, tildes y caracteres peligrosos', () => {
    for (const bad of ['Cartel', 'con espacio', 'campaña', '<script>', 'a;b', '../../etc', 'a'.repeat(41), '']) {
      expect(UTM_VALUE_REGEX.test(bad)).toBe(false);
    }
  });
});

describe('normalizeUtmValue', () => {
  it('recorta y pasa a minúsculas antes de validar', () => {
    expect(normalizeUtmValue('  Cartel ')).toBe('cartel');
  });

  it('devuelve null ante valores ausentes o inválidos', () => {
    expect(normalizeUtmValue(null)).toBe(null);
    expect(normalizeUtmValue(undefined)).toBe(null);
    expect(normalizeUtmValue('')).toBe(null);
    expect(normalizeUtmValue('nope!')).toBe(null);
  });
});

describe('parseUtmParams', () => {
  it('devuelve null si no hay utm_source válido', () => {
    expect(parseUtmParams('')).toBe(null);
    expect(parseUtmParams('?utm_medium=qr&utm_campaign=lanzamiento')).toBe(null);
    expect(parseUtmParams('?utm_source=<script>')).toBe(null);
  });

  it('extrae source, medium y campaign válidos', () => {
    expect(parseUtmParams('?utm_source=cartel&utm_medium=qr&utm_campaign=lanzamiento')).toEqual({
      source: 'cartel',
      medium: 'qr',
      campaign: 'lanzamiento',
    });
  });

  it('tolera medium/campaign ausentes o inválidos sin invalidar la visita', () => {
    expect(parseUtmParams('?utm_source=instagram')).toEqual({
      source: 'instagram',
      medium: null,
      campaign: null,
    });
    expect(parseUtmParams('?utm_source=instagram&utm_medium=NO VÁLIDO')).toEqual({
      source: 'instagram',
      medium: null,
      campaign: null,
    });
  });

  it('acepta URLSearchParams además de string', () => {
    expect(parseUtmParams(new URLSearchParams('utm_source=whatsapp'))?.source).toBe('whatsapp');
  });
});

describe('utmSessionKey', () => {
  it('distingue combinaciones completas source+medium+campaign', () => {
    const base = utmSessionKey({ source: 'cartel', medium: 'qr', campaign: 'lanzamiento' });
    expect(base).toBe('utm-tracked:cartel|qr|lanzamiento');
    expect(utmSessionKey({ source: 'cartel', medium: null, campaign: null })).not.toBe(base);
    expect(utmSessionKey({ source: 'instagram', medium: 'qr', campaign: 'lanzamiento' })).not.toBe(base);
  });
});
