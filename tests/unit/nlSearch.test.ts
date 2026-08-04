import { describe, expect, it } from 'vitest';
import { parseNaturalQuery } from '@/lib/nlSearch';

describe('parseNaturalQuery', () => {
  it('extrae estado FREE y lugar de «plaza libre cerca del Corte Inglés»', () => {
    const r = parseNaturalQuery('plaza libre cerca del Corte Inglés');
    expect(r.place).toBe('Corte Inglés');
    expect(r.status).toBe('FREE');
    expect(r.interpretation).toBe('Plazas libres cerca de Corte Inglés');
    expect(r.raw).toBe('plaza libre cerca del Corte Inglés');
  });

  it('conserva las tildes y mayúsculas del lugar', () => {
    const r = parseNaturalQuery('pmr por Gran Vía');
    expect(r.place).toBe('Gran Vía');
    expect(r.status).toBeNull();
    expect(r.interpretation).toBe('Plazas cerca de Gran Vía');
  });

  it('entiende «aparcar cerca del hospital» sin estado', () => {
    const r = parseNaturalQuery('aparcar cerca del hospital');
    expect(r.place).toBe('hospital');
    expect(r.status).toBeNull();
    expect(r.interpretation).toBe('Plazas cerca de Hospital');
  });

  it('elimina muletillas de petición («quiero aparcar cerca de…»)', () => {
    const r = parseNaturalQuery('quiero aparcar cerca del hospital Álvaro Cunqueiro');
    expect(r.place).toBe('hospital Álvaro Cunqueiro');
    expect(r.status).toBeNull();
  });

  it('reconoce «disponible» como FREE y limpia signos de interrogación', () => {
    const r = parseNaturalQuery('¿hay alguna plaza disponible por la zona de Samil?');
    expect(r.place).toBe('Samil');
    expect(r.status).toBe('FREE');
    expect(r.interpretation).toBe('Plazas libres cerca de Samil');
  });

  it('reconoce «ocupada» como OCCUPIED', () => {
    const r = parseNaturalQuery('plaza ocupada cerca de la estación');
    expect(r.place).toBe('estación');
    expect(r.status).toBe('OCCUPIED');
    expect(r.interpretation).toBe('Plazas ocupadas cerca de Estación');
  });

  it('reconoce «free» en inglés como FREE', () => {
    const r = parseNaturalQuery('plaza free por el centro');
    expect(r.place).toBe('centro');
    expect(r.status).toBe('FREE');
  });

  it('entiende «donde hay sitio libre cerca de…»', () => {
    const r = parseNaturalQuery('donde hay sitio libre cerca de Urzaiz');
    expect(r.place).toBe('Urzaiz');
    expect(r.status).toBe('FREE');
  });

  it('elimina «aparcamiento para minusválidos» y «movilidad reducida»', () => {
    expect(parseNaturalQuery('busco aparcamiento para minusválidos cerca del Corte Inglés').place).toBe(
      'Corte Inglés',
    );
    expect(parseNaturalQuery('plaza de movilidad reducida junto al Corte Inglés').place).toBe('Corte Inglés');
  });

  it('gana el primer estado si aparecen dos contradictorios', () => {
    const r = parseNaturalQuery('plaza libre u ocupada cerca del centro');
    expect(r.status).toBe('FREE');
    expect(r.place).toBe('centro');
  });

  it('una calle a secas no se interpreta: fallback al flujo clásico', () => {
    expect(parseNaturalQuery('gran vía')).toEqual({
      raw: 'gran vía',
      place: null,
      status: null,
      interpretation: null,
    });
    expect(parseNaturalQuery('calle colón').place).toBeNull();
  });

  it('un lugar compuesto con «de» se limpia sin romperse', () => {
    const r = parseNaturalQuery('estación de tren');
    expect(r.place).toBe('estación tren');
    expect(r.interpretation).toBe('Plazas cerca de Estación tren');
  });

  it('consulta vacía o demasiado corta devuelve todo a null', () => {
    expect(parseNaturalQuery('').place).toBeNull();
    expect(parseNaturalQuery('   ').place).toBeNull();
    expect(parseNaturalQuery('pm').place).toBeNull();
  });

  it('solo muletillas sin lugar («plazas libres») no inventa destino', () => {
    expect(parseNaturalQuery('plazas libres')).toEqual({
      raw: 'plazas libres',
      place: null,
      status: null,
      interpretation: null,
    });
    expect(parseNaturalQuery('plaza').place).toBeNull();
    expect(parseNaturalQuery('libre').place).toBeNull();
  });

  it('consulta rara sin palabras reconocibles devuelve null', () => {
    expect(parseNaturalQuery('???').place).toBeNull();
    expect(parseNaturalQuery('asdfgh').place).toBeNull();
  });

  it('es insensible a tildes en las keywords («cerca», «estacion»)', () => {
    const r = parseNaturalQuery('plaza libre cerca de la estacion de autobuses');
    expect(r.status).toBe('FREE');
    expect(r.place).toBe('estacion autobuses');
  });

  it('«necesito una plaza por el centro» extrae el lugar sin artículos', () => {
    const r = parseNaturalQuery('necesito una plaza por el centro');
    expect(r.place).toBe('centro');
    expect(r.status).toBeNull();
  });

  it('«al lado de» y «junto a» funcionan como «cerca de»', () => {
    expect(parseNaturalQuery('plaza libre al lado del Corte Inglés').place).toBe('Corte Inglés');
    expect(parseNaturalQuery('aparcar junto a la plaza de España').place).toBe('España');
  });

  it('«parking» y «estacionar» también son muletillas del dominio', () => {
    expect(parseNaturalQuery('parking libre cerca de Travesas').place).toBe('Travesas');
    expect(parseNaturalQuery('donde estacionar por el Casco Vello').place).toBe('Casco Vello');
  });

  it('«vacía» y «llena» se reconocen sin tilde en la keyword', () => {
    expect(parseNaturalQuery('plaza vacía por Teis').status).toBe('FREE');
    expect(parseNaturalQuery('plaza llena por Teis').status).toBe('OCCUPIED');
  });
});
