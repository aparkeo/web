import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { es } from '@/lib/i18n';
import { fmt } from '@/lib/i18n/format';

export type RelativeTimeStrings = typeof es.time;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatWalkTime(meters: number, strings: RelativeTimeStrings = es.time): string | null {
  if (meters > 2000) return null;
  const mins = Math.max(1, Math.round(meters / 80));
  return fmt(strings.walkTime, { n: mins });
}

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatRelativeTime(
  timestamp: number | Date,
  strings: RelativeTimeStrings = es.time,
): string {
  const ts = timestamp instanceof Date ? timestamp.getTime() : timestamp;
  const min = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (min < 1) return strings.justNow;
  if (min < 60) return fmt(strings.minutesAgo, { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return fmt(strings.hoursAgo, { n: hours });
  return fmt(strings.daysAgo, { n: Math.floor(hours / 24) });
}

export function labelForStatus(status: 'FREE' | 'OCCUPIED' | 'UNKNOWN'): string {
  switch (status) {
    case 'FREE':
      return 'Libre';
    case 'OCCUPIED':
      return 'Ocupada';
    default:
      return 'Sin datos';
  }
}

export function colorForStatus(status: 'FREE' | 'OCCUPIED' | 'UNKNOWN'): string {
  switch (status) {
    case 'FREE':
      return '#16A34A';
    case 'OCCUPIED':
      return '#DC2626';
    default:
      // slate-500: #94A3B8 solo daba 2.8:1 con blanco encima (contador de
      // clusters); slate-500 llega a 4.8:1 (AA) y se lee mejor sobre el mapa
      return '#64748B';
  }
}

/**
 * Clases de color de TEXTO por estado, conscientes del tema (un único color
 * hex no puede dar AA a la vez en claro y oscuro). Para gráficos del mapa
 * usa colorForStatus; para texto usa estas clases.
 */
export function statusTextClass(status: 'FREE' | 'OCCUPIED' | 'UNKNOWN'): string {
  switch (status) {
    case 'FREE':
      return 'text-[#15803D] dark:text-[#4ADE80]';
    case 'OCCUPIED':
      return 'text-[#B91C1C] dark:text-[#F87171]';
    default:
      return 'text-[#475569] dark:text-[#94A3B8]';
  }
}
