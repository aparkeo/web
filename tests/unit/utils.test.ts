import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  cn,
  colorForStatus,
  statusTextClass,
  distanceMeters,
  formatDistance,
  formatRelativeTime,
  formatWalkTime,
  labelForStatus,
} from '@/lib/utils';

describe('distanceMeters (haversine)', () => {
  it('devuelve 0 para la misma coordenada', () => {
    expect(distanceMeters(42.24, -8.72, 42.24, -8.72)).toBe(0);
  });

  it('es simétrica', () => {
    const a = distanceMeters(42.24, -8.72, 42.25, -8.71);
    const b = distanceMeters(42.25, -8.71, 42.24, -8.72);
    expect(a).toBeCloseTo(b, 10);
  });

  it('calcula una distancia conocida (~111 km por grado de latitud)', () => {
    const d = distanceMeters(42.0, -8.72, 43.0, -8.72);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('distancia corta con precisión razonable (0.01° de latitud ≈ 1.1 km)', () => {
    const d = distanceMeters(42.24, -8.72, 42.25, -8.72);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1200);
  });

  it('los antípodas están a ~media circunferencia terrestre (~20 015 km)', () => {
    const d = distanceMeters(0, 0, 0, 180);
    expect(d).toBeGreaterThan(19_900_000);
    expect(d).toBeLessThan(20_100_000);
  });

  it('maneja el cruce del antimeridiano sin distancias absurdas', () => {
    // 179.9°E → 179.9°O son ~22 km, no ~40 000 km.
    const d = distanceMeters(0, 179.9, 0, -179.9);
    expect(d).toBeLessThan(30_000);
  });
});

describe('formatDistance', () => {
  it('redondea metros por debajo de 1 km', () => {
    expect(formatDistance(42)).toBe('42 m');
    expect(formatDistance(999.4)).toBe('999 m');
  });

  it('usa km con un decimal a partir de 1000 m', () => {
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(2350)).toBe('2.4 km');
  });
});

describe('formatWalkTime', () => {
  it('devuelve null a más de 2 km (no tiene sentido ir andando)', () => {
    expect(formatWalkTime(2001)).toBeNull();
  });

  it('estima ~80 m/min con mínimo de 1 minuto', () => {
    expect(formatWalkTime(80)).toBe('~1 min a pie');
    expect(formatWalkTime(800)).toBe('~10 min a pie');
    expect(formatWalkTime(0)).toBe('~1 min a pie');
  });
});

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa "ahora mismo", minutos, horas y días según la antigüedad', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));
    const now = Date.now();

    expect(formatRelativeTime(now)).toBe('ahora mismo');
    expect(formatRelativeTime(now - 30_000)).toBe('ahora mismo');
    expect(formatRelativeTime(now - 5 * 60_000)).toBe('hace 5 min');
    expect(formatRelativeTime(now - 3 * 3_600_000)).toBe('hace 3 h');
    expect(formatRelativeTime(new Date(now - 2 * 86_400_000))).toBe('hace 2 d');
  });

  it('nunca devuelve valores negativos con fechas futuras', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));
    expect(formatRelativeTime(Date.now() + 60_000)).toBe('ahora mismo');
  });
});

describe('labelForStatus / colorForStatus', () => {
  it('etiqueta cada estado en español', () => {
    expect(labelForStatus('FREE')).toBe('Libre');
    expect(labelForStatus('OCCUPIED')).toBe('Ocupada');
    expect(labelForStatus('UNKNOWN')).toBe('Sin datos');
  });

  it('asigna verde/rojo/gris a cada estado', () => {
    expect(colorForStatus('FREE')).toBe('#16A34A');
    expect(colorForStatus('OCCUPIED')).toBe('#DC2626');
    expect(colorForStatus('UNKNOWN')).toBe('#64748B');
  });

  it('devuelve clases de texto conscientes del tema para cada estado', () => {
    for (const status of ['FREE', 'OCCUPIED', 'UNKNOWN'] as const) {
      const classes = statusTextClass(status);
      expect(classes).toContain('text-[');
      expect(classes).toContain('dark:text-[');
    }
  });
});

describe('cn', () => {
  it('fusiona clases y resuelve conflictos de Tailwind (gana la última)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm', undefined, false && 'hidden', 'font-bold')).toBe('text-sm font-bold');
  });
});
