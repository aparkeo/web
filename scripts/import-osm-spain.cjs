/**
 * Aparkeo — importación de plazas PMR de OpenStreetMap para toda España
 * (roadmap nº28, fase 1: datos).
 *
 * Cómo funciona (resumen):
 *   1. Para cada comunidad autónoma, consulta la Overpass API dentro del área
 *      ISO3166-2 (ES-XX) buscando plazas PMR (ver QUERY más abajo).
 *   2. Normaliza cada elemento (lat/lon con `center` para ways, dirección desde
 *      tags addr:*, source='osm', externalId='{type}/{osmId}').
 *   3. Upsert por (source, externalId): crea los nuevos con createMany en
 *      chunks de 500 y actualiza los existentes secuencialmente → idempotente,
 *      re-ejecutable sin duplicados y sin saturar el pooler de Supabase.
 *
 * Uso:
 *   node scripts/import-osm-spain.cjs                     # todas las comunidades
 *   node scripts/import-osm-spain.cjs --communities ES-RI,ES-CB
 *
 * Notas:
 *   - Los ids de los spots OSM se asignan desde un rango alto
 *     (>= OSM_ID_FLOOR) para no colisionar con los ids oficiales del Concello
 *     de Vigo (que llegan hasta ~12,6M).
 *   - `province` solo se rellena en comunidades uniprovinciales; en las demás
 *     queda null (el fragmento es a nivel de comunidad, sin geocodificación
 *     inversa a nivel de provincia).
 *   - `city` usa addr:city si existe; si no, el nombre de la comunidad.
 */

'use strict';

const path = require('path');

// Carga .env si DATABASE_URL no está ya en el entorno (Prisma CLI lo hace
// solo; un script node plano no).
if (!process.env.DATABASE_URL) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  } catch {
    const fs = require('fs');
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
      }
    }
  }
}

const { PrismaClient } = require('@prisma/client');

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const OSM_ID_FLOOR = 20_000_000; // los ids oficiales de Vigo llegan a ~12,6M
const CHUNK = 500;
const OVERPASS_TIMEOUT_S = 120;
const MAX_ATTEMPTS = 6; // por comunidad, rotando mirrors con backoff

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];

// ISO3166-2 → nombre de comunidad y provincia (solo si es uniprovincial).
const COMMUNITIES = [
  { iso: 'ES-AN', name: 'Andalucía', province: null },
  { iso: 'ES-AR', name: 'Aragón', province: null },
  { iso: 'ES-AS', name: 'Asturias', province: 'Asturias' },
  { iso: 'ES-CN', name: 'Canarias', province: null },
  { iso: 'ES-CB', name: 'Cantabria', province: 'Cantabria' },
  { iso: 'ES-CL', name: 'Castilla y León', province: null },
  { iso: 'ES-CM', name: 'Castilla-La Mancha', province: null },
  { iso: 'ES-CT', name: 'Cataluña', province: null },
  { iso: 'ES-EX', name: 'Extremadura', province: null },
  { iso: 'ES-GA', name: 'Galicia', province: null },
  { iso: 'ES-IB', name: 'Illes Balears', province: 'Illes Balears' },
  { iso: 'ES-RI', name: 'La Rioja', province: 'La Rioja' },
  { iso: 'ES-MD', name: 'Comunidad de Madrid', province: 'Madrid' },
  { iso: 'ES-MC', name: 'Región de Murcia', province: 'Murcia' },
  { iso: 'ES-NC', name: 'Navarra', province: 'Navarra' },
  { iso: 'ES-PV', name: 'País Vasco', province: null },
  { iso: 'ES-VC', name: 'Comunitat Valenciana', province: null },
  { iso: 'ES-CE', name: 'Ceuta', province: 'Ceuta' },
  { iso: 'ES-ML', name: 'Melilla', province: 'Melilla' },
];

// Tags capturados:
//   - nwr amenity=parking_space + parking_space=disabled   (tag dominante)
//   - nwr amenity=parking_space + disabled=yes|designated
//   - nwr amenity=parking_space + access:disabled=yes|designated
//   - nwr amenity=parking_space + capacity:disabled>=1
//   - way highway=* + parking:lane:{left,right,both}:disabled=designated
//     (plazas PMR en calle mapeadas como carril; se toma el centro de la vía)
function buildQuery(iso) {
  return `
[out:json][timeout:${OVERPASS_TIMEOUT_S}];
area["ISO3166-2"="${iso}"]->.a;
(
  nwr["amenity"="parking_space"]["parking_space"="disabled"](area.a);
  nwr["amenity"="parking_space"]["disabled"~"^(yes|designated)$"](area.a);
  nwr["amenity"="parking_space"]["access:disabled"~"^(yes|designated)$"](area.a);
  nwr["amenity"="parking_space"]["capacity:disabled"~"^[1-9]"](area.a);
  way["highway"]["parking:lane:left:disabled"="designated"](area.a);
  way["highway"]["parking:lane:right:disabled"="designated"](area.a);
  way["highway"]["parking:lane:both:disabled"="designated"](area.a);
);
out center tags;
`.trim();
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOverpass(query, attempt) {
  const mirror = OVERPASS_MIRRORS[attempt % OVERPASS_MIRRORS.length];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), (OVERPASS_TIMEOUT_S + 60) * 1000);
  try {
    const res = await fetch(mirror, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Los mirrors de Overpass bloquean/rate-limitan peticiones sin
        // User-Agent identificable (406 / 429).
        'User-Agent': 'Aparkeo/1.0 (importacion plazas PMR OSM; https://aparkeo.es)',
        Accept: 'application/json',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} desde ${mirror}: ${text.slice(0, 200)}`);
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      // Overpass a veces devuelve 200 con XML de error (servidor ocupado).
      throw new Error(`Respuesta no-JSON desde ${mirror}: ${text.slice(0, 200)}`);
    }
    if (!Array.isArray(json.elements)) {
      throw new Error(`Respuesta sin elements desde ${mirror}`);
    }
    return { elements: json.elements, mirror };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCommunity(iso) {
  const query = buildQuery(iso);
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchOverpass(query, attempt);
    } catch (err) {
      lastError = err;
      const backoff = Math.min(60_000, 5000 * (attempt + 1));
      console.warn(
        `  [${iso}] intento ${attempt + 1}/${MAX_ATTEMPTS} falló (${err.message}). Reintento en ${backoff / 1000}s...`
      );
      await sleep(backoff);
    }
  }
  throw lastError;
}

function normalize(el, community) {
  const tags = el.tags || {};
  const lat = el.type === 'node' ? el.lat : el.center && el.center.lat;
  const lon = el.type === 'node' ? el.lon : el.center && el.center.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const capDisabled = parseInt(tags['capacity:disabled'], 10);
  const addrStreet = tags['addr:street']
    ? `${tags['addr:street']}${tags['addr:housenumber'] ? ` ${tags['addr:housenumber']}` : ''}`
    : null;

  return {
    externalId: `${el.type}/${el.id}`,
    city: (tags['addr:city'] || community.name).trim(),
    street: (addrStreet || tags.name || 'Sin dirección').trim(),
    lat,
    lon,
    spaces: Number.isInteger(capDisabled) && capDisabled >= 1 ? capDisabled : 1,
    province: community.province,
    community: community.name,
    source: 'osm',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const argIdx = process.argv.indexOf('--communities');
  const only =
    argIdx !== -1 && process.argv[argIdx + 1]
      ? process.argv[argIdx + 1].split(',').map((s) => s.trim())
      : null;

  const targets = only
    ? COMMUNITIES.filter((c) => only.includes(c.iso))
    : COMMUNITIES;

  if (targets.length === 0) {
    console.error('Ninguna comunidad coincide con --communities', only);
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // Estado inicial: externalIds OSM ya importados y siguiente id libre.
    const existing = await prisma.parkingSpot.findMany({
      where: { source: 'osm' },
      select: { id: true, externalId: true },
    });
    const idByExternalId = new Map(existing.map((r) => [r.externalId, r.id]));

    const maxAgg = await prisma.parkingSpot.aggregate({ _max: { id: true } });
    let nextId = Math.max((maxAgg._max.id ?? 0) + 1, OSM_ID_FLOOR);

    console.log(
      `Inicio: ${existing.length} spots OSM ya en DB, nextId=${nextId}, ` +
        `${targets.length} comunidades a procesar.`
    );

    const summary = [];
    const failed = [];

    for (const community of targets) {
      const t0 = Date.now();
      console.log(`\n=== ${community.iso} — ${community.name} ===`);
      let elements;
      try {
        const res = await fetchCommunity(community.iso);
        elements = res.elements;
        console.log(`  Overpass (${res.mirror}): ${elements.length} elementos`);
      } catch (err) {
        console.error(`  FALLO DEFINITIVO en ${community.iso}: ${err.message}`);
        failed.push(community.iso);
        summary.push({ iso: community.iso, name: community.name, found: 0, created: 0, updated: 0, failed: true });
        continue;
      }

      // Dedup por externalId dentro del propio resultado (por seguridad).
      const seen = new Set();
      const rows = [];
      for (const el of elements) {
        const norm = normalize(el, community);
        if (!norm || seen.has(norm.externalId)) continue;
        seen.add(norm.externalId);
        rows.push(norm);
      }

      const creates = [];
      const updates = [];
      for (const row of rows) {
        const existingId = idByExternalId.get(row.externalId);
        if (existingId !== undefined) {
          updates.push({ id: existingId, data: row });
        } else {
          const id = nextId++;
          idByExternalId.set(row.externalId, id);
          creates.push({ id, ...row });
        }
      }

      // Creates: createMany en chunks secuenciales (nada de Promise.all masivo:
      // el pooler de Supabase limita a 15 conexiones — EMAXCONNSESSION).
      for (let i = 0; i < creates.length; i += CHUNK) {
        await prisma.parkingSpot.createMany({
          data: creates.slice(i, i + CHUNK),
          skipDuplicates: true,
        });
        if (creates.length > CHUNK) {
          console.log(`  creados ${Math.min(i + CHUNK, creates.length)}/${creates.length}`);
        }
      }

      // Updates: secuencial, chunk a chunk.
      let doneUpdates = 0;
      for (const u of updates) {
        await prisma.parkingSpot.update({ where: { id: u.id }, data: u.data });
        doneUpdates += 1;
        if (doneUpdates % CHUNK === 0) console.log(`  actualizados ${doneUpdates}/${updates.length}`);
      }

      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `  ${community.iso}: ${rows.length} plazas → ${creates.length} nuevas, ` +
          `${updates.length} actualizadas (${secs}s)`
      );
      summary.push({ iso: community.iso, name: community.name, found: rows.length, created: creates.length, updated: updates.length, failed: false });
    }

    // Resumen final
    console.log('\n================ RESUMEN ================');
    let totalFound = 0, totalCreated = 0, totalUpdated = 0;
    for (const s of summary) {
      totalFound += s.found; totalCreated += s.created; totalUpdated += s.updated;
      console.log(
        `${s.iso.padEnd(6)} ${s.name.padEnd(22)} encontradas=${String(s.found).padStart(5)} ` +
          `nuevas=${String(s.created).padStart(5)} actualizadas=${String(s.updated).padStart(5)}` +
          (s.failed ? '  [FALLÓ]' : '')
      );
    }
    console.log('------------------------------------------');
    console.log(`TOTAL  encontradas=${totalFound} nuevas=${totalCreated} actualizadas=${totalUpdated}`);
    const totalDb = await prisma.parkingSpot.count();
    const osmDb = await prisma.parkingSpot.count({ where: { source: 'osm' } });
    console.log(`DB: ${totalDb} spots en total (${osmDb} OSM)`);
    if (failed.length) {
      console.log(`Comunidades que fallaron tras ${MAX_ATTEMPTS} intentos: ${failed.join(', ')}`);
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
