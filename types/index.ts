export type SpotStatus = 'FREE' | 'OCCUPIED' | 'UNKNOWN';
export type Confidence = 'NONE' | 'LOW' | 'CONFIRMED' | 'DISPUTED';

export interface SpotDTO {
  id: number;
  city: string;
  street: string;
  lat: number;
  lon: number;
  spaces: number;
  status: SpotStatus;
  confidence: Confidence;
  lastReportAt: string | null;
  distanceM?: number;
  isFavorite?: boolean;
}

export interface PredictionDTO {
  spotId: number;
  probabilityFree: number;
  confidenceLabel: 'Alta' | 'Media' | 'Baja';
  source: 'live' | 'historical' | 'blended' | 'none';
  lastUpdated: string | null;
  sampleSize: number;
}

export interface SpotWithPrediction extends SpotDTO {
  prediction: PredictionDTO;
}

export interface ReportInput {
  spotId: number;
  status: 'FREE' | 'OCCUPIED';
  lat?: number;
  lon?: number;
  accuracyM?: number;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
}

/**
 * Dónde quiere aparcar el usuario — no siempre coincide con dónde está
 * ahora mismo (puede estar planificando un trayecto desde casa hacia el
 * hospital, p.ej.). La recomendación se busca alrededor de esto, no de la
 * ubicación GPS actual.
 */
export interface Destination {
  label: string;
  latitude: number;
  longitude: number;
  source: 'search' | 'current-location';
  /** Filtro de estado extraído de una búsqueda en lenguaje natural («plaza libre…»). */
  statusFilter?: 'FREE' | 'OCCUPIED';
  /** Frase legible de lo entendido por el parser de lenguaje natural. */
  interpretation?: string;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
}

export type StatusFilter = 'ALL' | 'FREE' | 'OCCUPIED';

export interface SpotFilters {
  status: StatusFilter;
  search: string;
  favoritesOnly: boolean;
}

export interface StatsSummary {
  totalSpots: number;
  free: number;
  occupied: number;
  unknown: number;
  totalReports: number;
  reportsLast24h: number;
  activeUsers: number;
}

export type NotificationType = 'FAVORITE_FREED' | 'NEARBY_FREE' | 'REPORT_CONFIRMED' | 'SYSTEM';

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  spotId: number | null;
  createdAt: string;
  spot: { id: number; street: string } | null;
}

export interface NotificationsResponse {
  notifications: NotificationDTO[];
  unreadCount: number;
}

export interface MarkNotificationsReadInput {
  id?: string;
  all?: boolean;
}
