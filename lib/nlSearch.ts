/**
 * Parser determinista de búsquedas en lenguaje natural en español
 * («plaza libre cerca del Corte Inglés», «pmr por gran vía»…).
 *
 * Sin LLM ni servicios externos: reglas y keywords, resultado reproducible
 * y testeable. Extrae dos cosas de la consulta cruda:
 *
 * - `status`: intención de estado de la plaza (FREE/OCCUPIED), si aparece.
 * - `place`: el nombre del lugar a geocodificar, una vez eliminadas las
 *   muletillas y palabras función («plaza», «aparcar», «cerca de», «quiero»…).
 *
 * Si la consulta no contiene nada interpretable (o es ya una calle/lugar «a
 * secas», sin nada que limpiar), devuelve todo a null y el llamador sigue el
 * flujo clásico: geocodificar el texto tal cual.
 */

export type NlStatusFilter = 'FREE' | 'OCCUPIED';

export interface NlSearchParse {
  /** Consulta original del usuario, sin tocar. */
  raw: string;
  /** Lugar extraído para geocodificar; null si no hay nada que interpretar. */
  place: string | null;
  /** Estado pedido («libre», «disponible» → FREE; «ocupada» → OCCUPIED). */
  status: NlStatusFilter | null;
  /** Frase legible de lo entendido, para mostrar al usuario. */
  interpretation: string | null;
}

const FREE_WORDS = new Set([
  'libre',
  'libres',
  'disponible',
  'disponibles',
  'free',
  'vacia',
  'vacias',
  'desocupada',
  'desocupadas',
]);

const OCCUPIED_WORDS = new Set([
  'ocupada',
  'ocupadas',
  'ocupado',
  'ocupados',
  'llena',
  'llenas',
  'completa',
  'completas',
]);

// Secuencias de muletillas multi-palabra (normalizadas: minúsculas, sin
// tildes). Se comprueban antes que las stopwords sueltas y gana la más larga.
const FILLER_PHRASES: string[][] = [
  ['por', 'la', 'zona', 'de'],
  ['en', 'la', 'zona', 'de'],
  ['cerca', 'de', 'la'],
  ['cerca', 'de', 'el'],
  ['al', 'lado', 'de', 'la'],
  ['al', 'lado', 'del'],
  ['al', 'lado', 'de'],
  ['cerca', 'del'],
  ['cerca', 'de'],
  ['junto', 'a', 'la'],
  ['junto', 'al'],
  ['junto', 'a'],
  ['zona', 'del'],
  ['zona', 'de'],
  ['donde', 'hay'],
  ['quiero', 'aparcar'],
  ['necesito', 'aparcar'],
  ['me', 'gustaria'],
  ['de', 'movilidad', 'reducida'],
  ['para', 'movilidad', 'reducida'],
  ['movilidad', 'reducida'],
  ['de', 'minusvalidos'],
  ['para', 'minusvalidos'],
].sort((a, b) => b.length - a.length);

const STOPWORDS = new Set([
  // Dominio PMR
  'plaza',
  'plazas',
  'pmr',
  'aparcar',
  'aparcamiento',
  'aparcamientos',
  'parking',
  'parkings',
  'estacionar',
  'minusvalido',
  'minusvalidos',
  'minusvalida',
  'minusvalidas',
  'discapacitado',
  'discapacitados',
  // Muletillas de petición
  'cerca',
  'junto',
  'lado',
  'zona',
  'donde',
  'hay',
  'quiero',
  'necesito',
  'busco',
  'buscando',
  'gustaria',
  'sitio',
  'sitios',
  // Palabras función
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'en',
  'por',
  'para',
  'una',
  'un',
  'unos',
  'unas',
  'alguna',
  'algunas',
  'algun',
  'al',
  'a',
  'con',
  'y',
  'o',
  'u',
  'me',
  'mi',
  'que',
  // Las palabras de estado también se eliminan del lugar
  ...FREE_WORDS,
  ...OCCUPIED_WORDS,
]);

/** Minúsculas sin tildes para comparar; el texto original se conserva aparte. */
function normalize(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

const EMPTY = (raw: string): NlSearchParse => ({
  raw,
  place: null,
  status: null,
  interpretation: null,
});

export function parseNaturalQuery(rawInput: string): NlSearchParse {
  const raw = rawInput.trim();
  if (raw.length < 3) return EMPTY(rawInput);

  // Tokeniza conservando el texto original (casing y tildes) del lugar.
  const tokens = raw.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (tokens.length === 0) return EMPTY(rawInput);
  const norm = tokens.map(normalize);

  // Estado: gana la primera palabra de estado que aparezca en la consulta.
  let status: NlStatusFilter | null = null;
  for (const t of norm) {
    if (FREE_WORDS.has(t)) {
      status = 'FREE';
      break;
    }
    if (OCCUPIED_WORDS.has(t)) {
      status = 'OCCUPIED';
      break;
    }
  }

  // Elimina muletillas (frases primero, stopwords después) y quédate con el lugar.
  const kept: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const phrase = FILLER_PHRASES.find((p) => p.every((w, k) => norm[i + k] === w));
    if (phrase) {
      i += phrase.length;
      continue;
    }
    if (STOPWORDS.has(norm[i])) {
      i += 1;
      continue;
    }
    kept.push(tokens[i]);
    i += 1;
  }

  const place = kept.join(' ').trim();
  if (!place) return EMPTY(rawInput);

  // Si el parser no ha transformado nada (p.ej. «gran vía» o «calle colón»),
  // no hay interpretación que mostrar: el llamador usa el texto tal cual.
  if (kept.length === tokens.length && status === null) return EMPTY(rawInput);

  const placeLabel = place.charAt(0).toUpperCase() + place.slice(1);
  const statusLabel = status === 'FREE' ? ' libres' : status === 'OCCUPIED' ? ' ocupadas' : '';

  return {
    raw: rawInput,
    place,
    status,
    interpretation: `Plazas${statusLabel} cerca de ${placeLabel}`,
  };
}
