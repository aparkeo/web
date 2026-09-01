/**
 * Generador de reportes sintéticos realistas para Aparkeo (PMR urbano, Vigo).
 *
 * NO toca ninguna base de datos: escribe data/synthetic-reports.csv con el
 * mismo shape que la tabla Report de Prisma (spotId,status,weight,reportedAt)
 * para entrenar/evaluar el modelo con `--synthetic` en
 * scripts/train-prediction-model.ts.
 *
 * Realismo simulado (~120 plazas, 8 semanas, ~4.000-5.000 reportes):
 *  - Cada plaza tiene una tasa base de ocupación propia (Irwin–Hall ≈ Beta,
 *    rango 0.25-0.9).
 *  - Patrón horario: laborables con picos 9-14 y 17-20, valle de siesta
 *    14-17, noche baja; sábado mañana alto; domingo bajo.
 *  - Pesos 0.5-1.5 ("reputación" simulada del autor).
 *  - Ruido: ~8% de reportes contradictorios (el estado reportado se invierte).
 *  - RNG sembrado (mulberry32) → mismo seed, mismo CSV.
 *
 * Uso:  npm run gen:synthetic
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface SyntheticReport {
  spotId: number;
  status: 'FREE' | 'OCCUPIED';
  weight: number;
  reportedAt: Date;
}

export const GEN_PARAMS = {
  spots: 120,
  weeks: 8,
  startIso: '2026-06-01T00:00:00.000Z', // lunes
  noiseRate: 0.08,
  defaultSeed: 20260601,
} as const;

/** RNG determinista (mulberry32). Duplicado del trainer: scripts independientes. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Factor horario de ocupación (>1 = más ocupación que la base de la plaza).
 * Laborable: picos 9-14 y 17-20, siesta 14-17, noche baja.
 * Sábado: mañana alta. Domingo: bajo todo el día.
 */
export function hourFactor(dayOfWeek: number, hour: number): number {
  if (dayOfWeek === 0) {
    // Domingo: bajo, con un leve repunte al mediodía.
    return hour >= 12 && hour < 16 ? 0.8 : 0.5;
  }
  if (dayOfWeek === 6) {
    if (hour >= 9 && hour < 14) return 1.25; // sábado mañana alto
    if (hour >= 14 && hour < 17) return 0.7;
    if (hour >= 17 && hour < 21) return 0.9;
    return 0.5;
  }
  if (hour >= 9 && hour < 14) return 1.3; // pico mañana laborable
  if (hour >= 14 && hour < 17) return 0.7; // siesta
  if (hour >= 17 && hour < 20) return 1.25; // pico tarde
  return 0.45; // noche / primera hora
}

/** Peso relativo de actividad de reporte por franja (los usuarios reportan más en horas de actividad). */
const REPORT_ACTIVITY: { from: number; to: number; weight: number }[] = [
  { from: 7, to: 9, weight: 1.0 },
  { from: 9, to: 14, weight: 2.5 },
  { from: 14, to: 17, weight: 1.2 },
  { from: 17, to: 20, weight: 2.2 },
  { from: 20, to: 23, weight: 0.8 },
];

/** Muestrea una hora 7-22 según la actividad de reporte. */
function sampleHour(rng: () => number): number {
  const slots: { hour: number; cumulative: number }[] = [];
  let total = 0;
  for (const band of REPORT_ACTIVITY) {
    for (let h = band.from; h < band.to; h++) {
      total += band.weight;
      slots.push({ hour: h, cumulative: total });
    }
  }
  const x = rng() * total;
  return (slots.find((s) => x < s.cumulative) ?? slots[slots.length - 1]).hour;
}

/**
 * Genera el dataset sintético completo (función pura, determinista por seed).
 * Los reportes salen ordenados por plaza y fecha; `reportedAt` en UTC.
 */
export function generateReports(seed: number = GEN_PARAMS.defaultSeed): SyntheticReport[] {
  const rng = mulberry32(seed);
  const startMs = Date.parse(GEN_PARAMS.startIso);
  const days = GEN_PARAMS.weeks * 7;
  const reports: SyntheticReport[] = [];

  for (let spotId = 1; spotId <= GEN_PARAMS.spots; spotId++) {
    // Tasa base de ocupación propia de la plaza: Irwin–Hall(3) ≈ Beta
    // simétrica, escalada a [0.25, 0.9].
    const baseOcc = 0.25 + 0.65 * ((rng() + rng() + rng()) / 3);

    for (let day = 0; day < days; day++) {
      // Nº de reportes de la plaza ese día: 55% → 1, 12% → 2, resto 0.
      const roll = rng();
      const count = roll < 0.55 ? 1 : roll < 0.67 ? 2 : 0;

      for (let k = 0; k < count; k++) {
        const hour = sampleHour(rng);
        const minute = Math.floor(rng() * 60);
        const reportedAt = new Date(startMs + day * 86_400_000 + hour * 3_600_000 + minute * 60_000);
        const dayOfWeek = reportedAt.getUTCDay();

        const pOccupied = Math.min(0.97, Math.max(0.03, baseOcc * hourFactor(dayOfWeek, hour)));
        let status: 'FREE' | 'OCCUPIED' = rng() < pOccupied ? 'OCCUPIED' : 'FREE';
        // Ruido: reportes contradictorios con la realidad simulada.
        if (rng() < GEN_PARAMS.noiseRate) {
          status = status === 'FREE' ? 'OCCUPIED' : 'FREE';
        }
        // Reputación simulada del autor, redondeada a 2 decimales.
        const weight = Math.round((0.5 + rng()) * 100) / 100;

        reports.push({ spotId, status, weight, reportedAt });
      }
    }
  }
  return reports;
}

/** Serializa a CSV con cabecera (mismo shape que Report de Prisma). */
export function toCsv(reports: SyntheticReport[]): string {
  const lines = ['spotId,status,weight,reportedAt'];
  for (const r of reports) {
    lines.push(`${r.spotId},${r.status},${r.weight.toFixed(2)},${r.reportedAt.toISOString()}`);
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// main(): escribe el CSV e imprime un resumen por franjas
// ---------------------------------------------------------------------------

function franjaLabel(dayOfWeek: number, hour: number): string {
  if (dayOfWeek === 0) return 'domingo';
  if (dayOfWeek === 6) return hour < 14 ? 'sábado mañana' : 'sábado resto';
  if (hour >= 9 && hour < 14) return 'laborable 9-14 (pico)';
  if (hour >= 14 && hour < 17) return 'laborable 14-17 (siesta)';
  if (hour >= 17 && hour < 20) return 'laborable 17-20 (pico)';
  return 'laborable noche';
}

async function main(): Promise<void> {
  const reports = generateReports();
  const csv = toCsv(reports);

  const here = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.resolve(here, '..', 'data', 'synthetic-reports.csv');
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, csv, 'utf8');

  // Resumen global y por franja.
  const freeGlobal = reports.filter((r) => r.status === 'FREE').length / reports.length;
  const byFranja = new Map<string, { free: number; total: number }>();
  for (const r of reports) {
    const label = franjaLabel(r.reportedAt.getUTCDay(), r.reportedAt.getUTCHours());
    const agg = byFranja.get(label) ?? { free: 0, total: 0 };
    agg.total++;
    if (r.status === 'FREE') agg.free++;
    byFranja.set(label, agg);
  }

  console.log(`CSV escrito en ${outPath}`);
  console.log(`Reportes: ${reports.length} · Plazas: ${GEN_PARAMS.spots} · Semanas: ${GEN_PARAMS.weeks}`);
  console.log(`Tasa FREE global: ${(freeGlobal * 100).toFixed(1)}%`);
  console.log('Tasa FREE por franja:');
  for (const [label, agg] of [...byFranja].sort()) {
    console.log(`  ${label.padEnd(26)} ${((agg.free / agg.total) * 100).toFixed(1)}%  (n=${agg.total})`);
  }
  console.log(`Tamaño: ${(Buffer.byteLength(csv) / 1024).toFixed(0)} KB`);
}

const invokedDirectly =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error('Fallo generando reportes sintéticos:', err);
    process.exitCode = 1;
  });
}
