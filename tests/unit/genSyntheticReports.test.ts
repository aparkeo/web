import { describe, expect, it } from 'vitest';
import {
  generateReports,
  hourFactor,
  mulberry32,
  toCsv,
  GEN_PARAMS,
} from '../../scripts/gen-synthetic-reports';
import { parseReportsCsv } from '../../scripts/train-prediction-model';

// Tests del generador sintético: funciones puras, NO tocan la BD ni disco
// (main() solo corre cuando el script se invoca directamente).

describe('generateReports (determinismo y rangos)', () => {
  it('misma semilla → mismo CSV exacto', () => {
    expect(toCsv(generateReports(123))).toBe(toCsv(generateReports(123)));
  });

  it('semillas distintas → datasets distintos', () => {
    expect(toCsv(generateReports(1))).not.toBe(toCsv(generateReports(2)));
  });

  it('volumen realista: 3000-6000 reportes, 120 plazas, 8 semanas', () => {
    const reports = generateReports();
    expect(reports.length).toBeGreaterThanOrEqual(3000);
    expect(reports.length).toBeLessThanOrEqual(6000);
    const spotIds = new Set(reports.map((r) => r.spotId));
    expect(spotIds.size).toBe(GEN_PARAMS.spots);
    const spanMs =
      Math.max(...reports.map((r) => r.reportedAt.getTime())) -
      Math.min(...reports.map((r) => r.reportedAt.getTime()));
    expect(spanMs).toBeLessThan(GEN_PARAMS.weeks * 7 * 86_400_000);
    expect(spanMs).toBeGreaterThan((GEN_PARAMS.weeks * 7 - 2) * 86_400_000);
  });

  it('todos los pesos están en [0.5, 1.5] y los status son FREE/OCCUPIED', () => {
    for (const r of generateReports()) {
      expect(r.weight).toBeGreaterThanOrEqual(0.5);
      expect(r.weight).toBeLessThanOrEqual(1.5);
      expect(['FREE', 'OCCUPIED']).toContain(r.status);
      expect(Number.isNaN(r.reportedAt.getTime())).toBe(false);
    }
  });
});

describe('patrón horario simulado (proporciones por franja)', () => {
  const reports = generateReports();
  const freeRate = (filter: (r: (typeof reports)[number]) => boolean) => {
    const sub = reports.filter(filter);
    return sub.filter((r) => r.status === 'FREE').length / sub.length;
  };
  const isWeekday = (d: number) => d >= 1 && d <= 5;

  it('pico laborable 9-14 más ocupado (menos FREE) que la siesta 14-17', () => {
    const peak = freeRate((r) => isWeekday(r.reportedAt.getUTCDay()) && r.reportedAt.getUTCHours() >= 9 && r.reportedAt.getUTCHours() < 14);
    const siesta = freeRate((r) => isWeekday(r.reportedAt.getUTCDay()) && r.reportedAt.getUTCHours() >= 14 && r.reportedAt.getUTCHours() < 17);
    expect(peak).toBeLessThan(siesta);
  });

  it('sábado mañana más ocupado que el domingo', () => {
    const satMorning = freeRate((r) => r.reportedAt.getUTCDay() === 6 && r.reportedAt.getUTCHours() < 14);
    const sunday = freeRate((r) => r.reportedAt.getUTCDay() === 0);
    expect(satMorning).toBeLessThan(sunday);
  });

  it('tasa FREE global en rango plausible (0.2-0.7)', () => {
    const global = freeRate(() => true);
    expect(global).toBeGreaterThan(0.2);
    expect(global).toBeLessThan(0.7);
  });
});

describe('hourFactor', () => {
  it('picos laborables > 1, siesta y noche < 1, domingo bajo', () => {
    expect(hourFactor(2, 10)).toBeGreaterThan(1); // laborable mañana
    expect(hourFactor(2, 18)).toBeGreaterThan(1); // laborable tarde
    expect(hourFactor(2, 15)).toBeLessThan(1); // siesta
    expect(hourFactor(2, 3)).toBeLessThan(1); // noche
    expect(hourFactor(0, 10)).toBeLessThan(hourFactor(6, 10)); // domingo < sábado mañana
  });
});

describe('toCsv + parseReportsCsv (roundtrip con el trainer)', () => {
  it('el CSV generado se parsea de vuelta sin pérdida', () => {
    const reports = generateReports(7);
    const parsed = parseReportsCsv(toCsv(reports));
    expect(parsed).toHaveLength(reports.length);
    expect(parsed[0]).toEqual({
      spotId: reports[0].spotId,
      status: reports[0].status,
      weight: reports[0].weight,
      reportedAt: reports[0].reportedAt,
    });
  });

  it('parseReportsCsv rechaza status inválidos', () => {
    expect(() =>
      parseReportsCsv('spotId,status,weight,reportedAt\n1,CASI,1,2026-06-01T10:00:00.000Z'),
    ).toThrow(/status inválido/);
  });
});

describe('mulberry32 (duplicado del generador)', () => {
  it('determinista y en [0, 1)', () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(v).toBe(b());
    }
  });
});
