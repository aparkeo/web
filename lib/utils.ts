import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatWalkTime(meters: number): string | null {
  if (meters > 2000) return null;
  const mins = Math.max(1, Math.round(meters / 80));
  return `~${mins} min a pie`;
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

export function formatRelativeTime(timestamp: number | Date): string {
  const ts = timestamp instanceof Date ? timestamp.getTime() : timestamp;
  const min = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
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
      return '#94A3B8';
  }
}
