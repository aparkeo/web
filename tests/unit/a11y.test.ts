import { describe, expect, it } from 'vitest';
import { geocodeResultsAnnouncement, spotsCountAnnouncement } from '@/lib/a11y';

describe('spotsCountAnnouncement', () => {
  it('anuncia que no hay coincidencias con 0 plazas', () => {
    expect(spotsCountAnnouncement(0)).toBe('Ninguna plaza coincide con los filtros.');
  });

  it('usa singular con 1 plaza', () => {
    expect(spotsCountAnnouncement(1)).toBe('Se muestra 1 plaza.');
  });

  it('usa plural con varias plazas', () => {
    expect(spotsCountAnnouncement(2)).toBe('Se muestran 2 plazas.');
    expect(spotsCountAnnouncement(128)).toBe('Se muestran 128 plazas.');
  });
});

describe('geocodeResultsAnnouncement', () => {
  it('anuncia la ausencia de resultados', () => {
    expect(geocodeResultsAnnouncement(0)).toBe('Sin resultados en Vigo.');
  });

  it('usa singular con 1 resultado', () => {
    expect(geocodeResultsAnnouncement(1)).toBe('1 resultado encontrado.');
  });

  it('usa plural con varios resultados', () => {
    expect(geocodeResultsAnnouncement(3)).toBe('3 resultados encontrados.');
  });
});
