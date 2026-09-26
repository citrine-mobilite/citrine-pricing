export type UserRole = 'admin' | 'responsable' | 'employe';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface City {
  id: string;
  name: string;
  country: string;
  currency: string;
  currencySymbol: string;
  active: boolean;
  center: {
    lat: number;
    lng: number;
  };
  autoSchedule: {
    enabled: boolean;
    slots: string[];
    lastRunAt?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Neighborhood {
  id: string;
  cityId: string;
  cityName?: string;
  name: string;
  lat: number;
  lng: number;
  active: boolean;
  zoneType?: 'commercial' | 'residential' | 'airport' | 'popular' | 'center';
  fullAddress?: string;
  district?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CampaignStatus = 'pending' | 'in_progress' | 'completed' | 'error' | 'cancelled';
export type TriggerType = 'manual' | 'scheduled';

export interface CampaignLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  pair?: string;
  latencyMs?: number;
}

export interface TariffQuote {
  tariffClass: string; // 'econom' | 'business' | 'comfort' | 'comfortplus' | 'moto' | string
  className: string;   // 'Éco' | 'Confort' | 'Confort+' | 'Moto'
  price: number;
  priceFormatted: string;
  pricePerKm: number;
  waitingTimeMinutes?: number;
  detailsTariff?: Array<{ type: string; value: string }>;
  rawServiceLevel?: any;
}

export interface HeroDriver {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  distanceKm: number;
  rating: number;
  lat: number;
  lng: number;
  carTypes: string;
  onlineStatus: string;
  imageUrl?: string;
}

export interface HeroQuote {
  success: boolean;
  price: number;
  priceFormatted: string;
  pricePerKm: number;
  priceStandard?: number;
  priceConfort?: number;
  priceSuv?: number;
  priceGrossStandard?: number;
  priceGrossConfort?: number;
  availableDriversCount: number;
  closestDriverDistanceKm?: number;
  closestDriverName?: string;
  closestDriverRating?: number;
  waitingTimeMinutes: number;
  drivers?: HeroDriver[];
  rawResponse?: any;
  source: 'hero_live';
  latencyMs?: number;
  httpStatus?: number;
  errorMessage?: string;
}

export interface PricingCampaign {
  id: string;
  cityId: string;
  cityName: string;
  currency: string;
  triggerType: TriggerType;
  triggeredByUserId: string;
  triggeredByUserName: string;
  status: CampaignStatus;
  providerMode?: 'benchmark' | 'yango' | 'hero';
  selectedClasses?: string[]; // ['econom', 'business', 'comfortplus', 'moto']
  totalPairs: number;
  completedPairs: number;
  failedPairs: number;
  startedAt: string;
  finishedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
  avgPrice?: number;
  minPrice?: number;
  maxPrice?: number;
  avgDistanceKm?: number;
  avgPricePerKm?: number;
  errorCount?: number;
  logs?: CampaignLog[];
  // Test sample properties
  sampleLimit?: number;
  totalPossiblePairs?: number;
  isTestSample?: boolean;
  batchSize?: number;
  totalBatches?: number;
  completedBatches?: number;
  concurrency?: number;
  lastYangoResponse?: any;
  lastHeroResponse?: any;
  // Multi-Class Statistics
  classStats?: Record<string, {
    className: string;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    count: number;
  }>;
  // Hero Statistics & Benchmark Comparison
  heroStats?: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    avgDriversCount: number;
    avgClosestDriverDistanceKm: number;
  };
  deltaStats?: {
    yangoCheaperCount: number;
    heroCheaperCount: number;
    equalCount: number;
    avgDeltaFcfa: number;
  };
}

export interface TripResult {
  id: string;
  campaignId: string;
  cityId: string;
  cityName?: string;
  startNeighborhoodId: string;
  startNeighborhoodName: string;
  startCoordinates?: [number, number]; // [lat, lng]
  startCoords?: { lat: number; lng: number };
  endNeighborhoodId: string;
  endNeighborhoodName: string;
  endCoordinates?: [number, number]; // [lat, lng]
  endCoords?: { lat: number; lng: number };
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  tariffClass: string; // main/selected class
  price: number; // default class price
  priceFormatted: string;
  currency: string;
  pricePerKm: number;
  waitingTimeMinutes?: number;

  // Multi-Class support (all 4 classes: econom, confort, confort+, moto)
  classes?: Record<string, TariffQuote>;
  availableClasses?: string[];
  priceEconom?: number;
  priceConfort?: number;
  priceConfortPlus?: number;
  priceMoto?: number;

  // Dual Provider Benchmark (Yango vs Hero)
  heroQuote?: HeroQuote;
  priceHero?: number;
  priceHeroStandard?: number;
  priceHeroConfort?: number;
  heroDriversCount?: number;
  heroClosestDriverDistanceKm?: number;
  deltaPriceYangoVsHero?: number; // Yango price - Hero price
  cheaperProvider?: 'yango' | 'hero' | 'equal';

  source: 'yango_live' | 'yango_fallback' | 'yango_routestats';
  status?: 'success' | 'failed';
  errorMessage?: string;
  createdAt?: string;
  // Raw API Inspection & Verification
  rawResponse?: any;
  requestPayload?: any;
  httpStatus?: number;
  apiCallDetails?: {
    endpoint: string;
    sentAt: string;
    latencyMs: number;
    httpStatus?: number;
    requestBody?: any;
    rawResponseBody?: any;
    error?: string;
    source?: string;
  };
}

export interface YangoSettings {
  apiEndpoint: string;
  bearerToken?: string;
  userAgent?: string;
  requestDelayMs: number;
  mode?: 'live';
  classes: {
    id: string;
    name: string;
    label: string;
  }[];
}

export interface HeroSettings {
  apiEndpoint: string;
  email: string;
  password?: string;
  requestDelayMs: number;
  mode?: 'live';
  classes?: {
    id: string;
    name: string;
    label: string;
  }[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface HistoryRecord {
  id: string;
  action: string;
  eventType: 'campaign' | 'system' | 'settings' | 'users' | 'neighborhoods' | 'cities';
  title: string;
  description?: string;
  performedBy?: string;
  performedByName?: string;
  timestamp: string;
  status?: 'success' | 'failed' | 'in_progress' | 'cancelled';
  metadata?: Record<string, any>;
}
