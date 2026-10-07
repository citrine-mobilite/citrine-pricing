export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface Neighborhood {
  id: string;
  cityId: string;
  name: string;
  lat: number;
  lng: number;
  active: boolean;
  zoneType?: 'commercial' | 'residential' | 'airport' | 'popular' | 'center';
  createdAt?: string;
  orderIndex?: number;
}

export interface City {
  id: string;
  name: string;
  country: string;
  currency: string;
  currencySymbol: string;
  center: GeoCoordinate;
  active: boolean;
  autoSchedule: {
    enabled: boolean;
    slots: string[];
    lastRunAt?: string;
  };
  neighborhoods?: Neighborhood[];
}

export interface CanonicalTripPrices {
  yango: {
    eco: number | null;
    confort: number | null;
    confortPlus: number | null;
    moto: number | null;
    jams?: boolean;
    yangoUnavailable?: boolean;
  };
  heroCab: {
    eco: number | null;
    confort: number | null;
    suv: number | null;
    perKm: number | null;
  };
  tripMaster: {
    eco: number | null;
    confort: number | null;
    moto: number | null;
  };
}

export interface CanonicalTrip {
  id: string;
  origin: string;
  destination: string;
  distanceKm: number;
  durationMin: number;
  jams?: boolean; // Heure de pointe détectée par Yango (jams: true)
  yangoUnavailable?: boolean; // Pénurie / Pas de voiture Yango disponible (no_free_cars_nearby)
  yangoWaitingMinutes?: number; // Temps d'attente estimé Yango (ex: 4 min)
  yangoUnavailableClasses?: string[]; // Classes indisponibles (ex: ['comfortplus', 'moto'])
  prices: CanonicalTripPrices;
  cheapest: {
    eco: string | null;
    confort: string | null;
    overall: string | null;
  };
  status?: 'success' | 'failed';
  createdAt?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'responsable' | 'employe';
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
  passwordHash?: string;
}

export interface CampaignLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  pair?: string;
  latencyMs?: number;
}

export interface TariffQuote {
  tariffClass: string;
  className: string;
  price: number;
  priceFormatted: string;
  pricePerKm: number;
  waitingTimeMinutes?: number;
  detailsTariff?: Array<{ type: string; value: string }>;
  rawServiceLevel?: any;
}

export interface HeroQuote {
  success: boolean;
  price: number;
  priceFormatted: string;
  pricePerKm: number;
  priceStandard?: number;
  priceConfort?: number;
  priceSuv?: number;
  availableDriversCount: number;
  closestDriverDistanceKm?: number;
  closestDriverName?: string;
  closestDriverRating?: number;
  waitingTimeMinutes: number;
  rawResponse?: any;
  source: 'hero_live';
  latencyMs?: number;
  httpStatus?: number;
  errorMessage?: string;
}

export interface TripMasterQuote {
  success?: boolean;
  distanceKm?: number;
  durationMinutes?: number;
  priceEco?: number;
  priceConfort?: number;
  priceMoto?: number;
  rawResponse?: any;
  latencyMs?: number;
  httpStatus?: number;
  errorMessage?: string;
}

export interface TripResult {
  id: string;
  campaignId: string;
  cityId?: string;
  cityName?: string;
  origin: string;
  destination: string;
  startNeighborhoodId?: string;
  startNeighborhoodName?: string;
  startCoordinates?: [number, number];
  endNeighborhoodId?: string;
  endNeighborhoodName?: string;
  endCoordinates?: [number, number];
  distanceMeters?: number;
  distanceKm: number;
  durationSeconds?: number;
  durationMinutes: number;
  jams?: boolean; // Heure de pointe détectée par Yango (jams: true)
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

  // Multi-Class support (legacy optional)
  classes?: Record<string, any>;
  availableClasses?: string[];
  priceEconom?: number;
  priceConfort?: number;
  priceConfortPlus?: number;
  priceMoto?: number;

  // Dual Provider Benchmark (legacy optional)
  heroQuote?: HeroQuote;
  priceHero?: number;
  priceHeroStandard?: number;
  priceHeroConfort?: number;
  priceHeroSuv?: number;
  priceHeroPerKm?: number;
  heroDriversCount?: number;
  heroClosestDriverDistanceKm?: number;
  deltaPriceYangoVsHero?: number;
  cheaperProvider?: 'yango' | 'hero' | 'tripmaster' | 'equal';

  // Trip Master Cameroon (legacy optional)
  tripMasterQuote?: TripMasterQuote;
  priceTripMaster?: number;
  priceTripMasterConfort?: number;
  priceTripMasterMoto?: number;

  // Direct flat properties for table display
  yango_eco?: number;
  yango_confort?: number;
  yango_moto?: number;
  hero_eco?: number;
  hero_confort?: number;
  hero_suv?: number;
  tripmaster_eco?: number;
  tripmaster_confort?: number;
  tripmaster_moto?: number;

  source?: 'yango_live' | 'yango_fallback' | 'yango_routestats' | string;
  status?: 'success' | 'failed';
  errorMessage?: string;
  createdAt?: string;

  // Inspection
  rawResponse?: any;
  requestPayload?: any;
  httpStatus?: number;
  apiCallDetails?: any;
}

export interface PricingCampaign {
  id: string;
  cityId: string;
  cityName: string;
  currency: string;
  triggerType: 'manual' | 'scheduled';
  triggeredByUserId?: string;
  triggeredByUserName?: string;
  triggeredByUserRole?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error' | 'failed' | 'cancelled';
  providerMode?: 'benchmark' | 'yango' | 'hero';
  selectedClasses?: string[];
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
  workersCount?: number;
  isTestSample?: boolean;
  sampleLimit?: number;
  totalPossiblePairs?: number;
  comment?: string; // Commentaire libre sur la campagne (ex: météo, pluie, contexte de circulation, etc.)
  comments?: string; // Alias
  scopeMode?: 'city' | 'intra' | 'inter';
  arrondissement?: string;
  originArrondissement?: string;
  destArrondissement?: string;
  hasJamsCount?: number; // Nombre de trajets avec jams: true
  yangoShortageCount?: number; // Nombre de trajets avec pénurie de chauffeurs Yango
  batchSize?: number;
  totalBatches?: number;
  completedBatches?: number;
  concurrency?: number;
  classStats?: Record<string, any>;
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
  canonicalTripsCount?: number;
}

export interface ActivePricingSession {
  campaign: PricingCampaign;
  trips: TripResult[];
  canonicalTrips: CanonicalTrip[];
  abortController: AbortController;
  cancelled: boolean;
}

export interface SystemSettings {
  id: string;
  apiEndpoint?: string;
  bearerToken?: string;
  searchVehicleEndpoint?: string;
  distanceEndpoint?: string;
  mode?: string;
  requestDelayMs?: number;
  enabled?: boolean;
  updatedAt?: string;
}
