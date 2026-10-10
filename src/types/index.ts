export type UserRole = 'admin' | 'responsable' | 'employe';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
  passwordHash?: string;
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
  ville?: string;
  departement?: string;
  arrondissement?: string;
  name: string;
  zone?: string;
  zoneType?: 'commercial' | 'residential' | 'airport' | 'popular' | 'center' | string;
  status?: 'actif' | 'inactif' | boolean | string;
  active: boolean;
  lat: number;
  lng: number;
  fullAddress?: string;
  district?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CampaignStatus = 'pending' | 'in_progress' | 'completed' | 'error' | 'failed' | 'cancelled';
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
  priceVip?: number;
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
  triggeredByUserRole?: string;
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
  lastError?: string;
  errorMessage?: string;
  logs?: CampaignLog[];
  // Test sample properties
  sampleLimit?: number;
  totalPossiblePairs?: number;
  isTestSample?: boolean;
  comment?: string; // Commentaire sur la campagne (météo, trafic, etc.)
  comments?: string;
  scopeMode?: 'city' | 'intra' | 'inter' | 'global';
  arrondissement?: string;
  originArrondissement?: string;
  destArrondissement?: string;
  arrondissementStats?: Record<string, {
    arrondissement: string;
    avgPrice: number;
    heroAvgPrice?: number;
    tripMasterAvgPrice?: number;
    count: number;
  }>;
  hasJamsCount?: number;
  yangoShortageCount?: number; // Nombre de trajets avec pénurie de chauffeurs Yango
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
  classesStats?: Record<string, any>;
  // Hero Statistics & Benchmark Comparison
  heroStats?: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    avgDriversCount: number;
    avgClosestDriverDistanceKm: number;
  };
  tripMasterStats?: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
  };
  deltaStats?: {
    yangoCheaperCount: number;
    heroCheaperCount: number;
    equalCount: number;
    avgDeltaFcfa: number;
  };
}

export interface CanonicalTripPrices {
  yango?: {
    eco: number | null;
    confort: number | null;
    confortPlus: number | null;
    moto: number | null;
  };
  heroCab?: {
    eco: number | null;
    confort: number | null;
    suv: number | null;
    perKm: number | null;
  };
  tripMaster?: {
    eco: number | null;
    confort: number | null;
    moto: number | null;
  };
}

export interface TripResult {
  id: string;
  campaignId: string;
  cityId?: string;
  cityName?: string;
  origin: string;
  destination: string;
  startNeighborhoodName?: string;
  endNeighborhoodName?: string;
  startNeighborhoodId?: string;
  endNeighborhoodId?: string;
  distanceMeters?: number;
  distanceKm: number;
  durationSeconds?: number;
  durationMinutes: number;
  jams?: boolean; // Heure de pointe Yango (jams: true)
  yangoUnavailable?: boolean; // Pénurie / Pas de voiture Yango disponible (no_free_cars_nearby)
  yangoWaitingMinutes?: number; // Temps d'attente estimé Yango (ex: 4 min)
  yangoUnavailableClasses?: string[]; // Classes indisponibles (ex: ['comfortplus', 'moto'])
  tariffClass?: string;
  price?: number;
  priceFormatted?: string;
  currency?: string;
  pricePerKm?: number;
  waitingTimeMinutes?: number;

  // Clean Canonical Multi-Provider Prices
  prices: CanonicalTripPrices;
  cheapest?: {
    eco: string | null;
    confort: string | null;
    overall: string | null;
  };

  // Optional legacy flat fields (backward compatibility)
  classes?: Record<string, any>;
  priceEconom?: number;
  priceConfort?: number;
  priceConfortPlus?: number;
  priceMoto?: number;
  priceHero?: number;
  priceHeroStandard?: number;
  priceHeroConfort?: number;
  priceHeroSuv?: number;
  priceHeroPerKm?: number;
  priceTripMaster?: number;
  priceTripMasterConfort?: number;
  priceTripMasterMoto?: number;
  yango_eco?: number;
  yango_confort?: number;
  yango_confort_plus?: number;
  yango_moto?: number;
  hero_eco?: number;
  hero_confort?: number;
  hero_suv?: number;
  hero_per_km?: number;
  tripmaster_eco?: number;
  tripmaster_confort?: number;
  tripmaster_moto?: number;
  cheaperProvider?: 'yango' | 'hero' | 'tripmaster' | 'equal';
  deltaPriceYangoVsHero?: number;

  heroQuote?: HeroQuote;
  tripMasterQuote?: any;
  source?: string;
  status?: 'success' | 'failed';
  errorMessage?: string;
  createdAt?: string;
  rawResponse?: any;
  requestPayload?: any;
  httpStatus?: number;
  apiCallDetails?: any;
}

export interface YangoSettings {
  apiEndpoint: string;
  bearerToken?: string;
  userAgent?: string;
  requestDelayMs: number;
  mode?: 'live';
  enabled?: boolean;
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
  enabled?: boolean;
  classes?: {
    id: string;
    name: string;
    label: string;
  }[];
}

export interface TripMasterSettings {
  distanceEndpoint: string;
  searchVehicleEndpoint: string;
  requestDelayMs: number;
  mode: 'live';
  enabled?: boolean;
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
