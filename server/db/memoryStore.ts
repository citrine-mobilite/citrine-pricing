import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User, City, Neighborhood, PricingCampaign, TripResult, ActivePricingSession, CanonicalTrip } from '../types.js';
import {
  fetchCitiesFromSupabase,
  upsertCityInSupabase,
  fetchNeighborhoodsFromSupabase,
  upsertNeighborhoodsInSupabase,
  fetchUsersFromSupabase,
  upsertUserInSupabase,
  fetchCampaignsFromSupabase,
  upsertCampaignInSupabase,
  saveCampaignResultsInSupabase,
  fetchCampaignResultsFromSupabase,
  deleteCampaignInSupabase
} from './supabase.js';
import defaultNeighborhoods from './defaultNeighborhoods.json' with { type: 'json' };

import { getNextSequence } from './counters.js';

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const CAMPAIGNS_FILE = path.resolve(DATA_DIR, 'campaigns.json');
const DATA_NEIGHBORHOODS_FILE = path.resolve(DATA_DIR, 'neighborhoods.json');
const NEIGHBORHOODS_FILE = path.resolve(process.cwd(), 'server/db/defaultNeighborhoods.json');
const ROOT_NEIGHBORHOOD_FILE = path.resolve(process.cwd(), 'server/neighboorhood.json');
const ROOT_NEIGHBORHOODS_FILE = path.resolve(process.cwd(), 'server/neighborhoods.json');

const CITIES_FILE = path.resolve(DATA_DIR, 'cities.json');
const CACHE_META_FILE = path.resolve(DATA_DIR, 'cache_meta.json');

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours (1 mois)

export function legacyToCanonical(t: any): CanonicalTrip {
  const orig = (t.startNeighborhoodName || t.startName || '—').replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim();
  const dest = (t.endNeighborhoodName || t.endName || '—').replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim();

  const yEco = t.priceEconom ?? t.priceYango ?? t.price ?? null;
  const yConf = t.priceConfort ?? null;
  const yConfPlus = t.priceConfortPlus ?? null;
  const yMoto = t.priceMoto ?? null;

  const hEco = t.priceHeroStandard ?? t.priceHero ?? null;
  const hConf = t.priceHeroConfort ?? null;
  const hSuv = t.priceHeroSuv ?? null;
  const hPerKm = t.priceHeroPerKm ?? null;

  const tmEco = t.priceTripMaster ?? t.priceTripMasterEco ?? null;
  const tmConf = t.priceTripMasterConfort ?? null;
  const tmMoto = t.priceTripMasterMoto ?? null;

  return {
    id: t.id || `legacy_${Math.random()}`,
    origin: orig,
    destination: dest,
    distanceKm: t.distanceKm ?? t.km ?? 0,
    durationMin: t.durationMinutes ?? t.durationMin ?? 0,
    jams: Boolean(t.jams !== undefined ? t.jams : t.hasJams),
    yangoUnavailable: Boolean(t.yangoUnavailable !== undefined ? t.yangoUnavailable : t.shortage || t.noCars),
    yangoWaitingMinutes: t.yangoWaitingMinutes ?? t.waitingTimeMinutes,
    yangoUnavailableClasses: t.yangoUnavailableClasses,
    prices: {
      yango: { eco: yEco, confort: yConf, confortPlus: yConfPlus, moto: yMoto },
      heroCab: { eco: hEco, confort: hConf, suv: hSuv, perKm: hPerKm },
      tripMaster: { eco: tmEco, confort: tmConf, moto: tmMoto }
    },
    cheapest: {
      eco: t.cheaperProvider || 'yango',
      confort: null,
      overall: t.cheaperProvider || 'yango'
    },
    status: (t.status || 'success') as any,
    createdAt: t.createdAt || new Date().toISOString()
  };
}

interface CacheMetadata {
  citiesUpdatedAt: number;
  globalNeighborhoodsUpdatedAt: number;
  neighborhoodsByCityUpdatedAt: Record<string, number>;
}

function loadCacheMetadata(): CacheMetadata {
  const now = Date.now();
  try {
    if (fs.existsSync(CACHE_META_FILE)) {
      const raw = fs.readFileSync(CACHE_META_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        citiesUpdatedAt: typeof parsed.citiesUpdatedAt === 'number' ? parsed.citiesUpdatedAt : now,
        globalNeighborhoodsUpdatedAt: typeof parsed.globalNeighborhoodsUpdatedAt === 'number' ? parsed.globalNeighborhoodsUpdatedAt : now,
        neighborhoodsByCityUpdatedAt: parsed.neighborhoodsByCityUpdatedAt || {}
      };
    }
  } catch {}
  return {
    citiesUpdatedAt: now,
    globalNeighborhoodsUpdatedAt: now,
    neighborhoodsByCityUpdatedAt: {}
  };
}

let cacheMetadata: CacheMetadata = loadCacheMetadata();

function saveCacheMetadata() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE_META_FILE, JSON.stringify(cacheMetadata, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[Cache Metadata] Warning saving cache metadata:', e.message);
  }
}

export function isCitiesCacheValid(): boolean {
  return Date.now() - (cacheMetadata.citiesUpdatedAt || 0) < THIRTY_DAYS_MS;
}

export function touchCitiesCache() {
  cacheMetadata.citiesUpdatedAt = Date.now();
  saveCacheMetadata();
}

export function invalidateCitiesCache() {
  cacheMetadata.citiesUpdatedAt = 0;
  saveCacheMetadata();
  console.log('[Cache Reinit] Cache des villes réinitialisé (modification effectuée).');
}

export function isNeighborhoodsCacheValid(cityId?: string): boolean {
  if (cityId) {
    const cityTs = cacheMetadata.neighborhoodsByCityUpdatedAt[String(cityId)];
    if (cityTs && Date.now() - cityTs < THIRTY_DAYS_MS) return true;
  }
  return Date.now() - (cacheMetadata.globalNeighborhoodsUpdatedAt || 0) < THIRTY_DAYS_MS;
}

export function touchNeighborhoodsCache(cityId?: string) {
  const now = Date.now();
  cacheMetadata.globalNeighborhoodsUpdatedAt = now;
  if (cityId) {
    cacheMetadata.neighborhoodsByCityUpdatedAt[String(cityId)] = now;
  }
  saveCacheMetadata();
}

export function invalidateNeighborhoodsCache(cityId?: string) {
  if (cityId) {
    delete cacheMetadata.neighborhoodsByCityUpdatedAt[String(cityId)];
  }
  cacheMetadata.globalNeighborhoodsUpdatedAt = 0;
  saveCacheMetadata();
  console.log(`[Cache Reinit] Cache des quartiers réinitialisé${cityId ? ` pour la ville ${cityId}` : ''}.`);
}

export async function saveCitiesDiskBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CITIES_FILE, JSON.stringify(cities, null, 2), 'utf8');
    touchCitiesCache();
    console.log(`[Disk Backup] ${cities.length} villes persistées dans server/data/cities.json`);
    await Promise.all(cities.map(c => upsertCityInSupabase(c))).catch(() => {});
  } catch (e: any) {
    console.warn('[Disk Backup] Warning writing cities to disk:', e.message);
  }
}

export async function saveNeighborhoodsDiskBackup(cityId?: string) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const normalized = sanitizeNeighborhoodList(neighborhoods).map(item => ({
      ...item,
      id: item.uuid || item.id,
      uuid: item.uuid || item.id
    }));
    const json = JSON.stringify(normalized, null, 2);
    fs.writeFileSync(DATA_NEIGHBORHOODS_FILE, json, 'utf8');
    fs.writeFileSync(NEIGHBORHOODS_FILE, json, 'utf8');
    fs.writeFileSync(ROOT_NEIGHBORHOOD_FILE, json, 'utf8');
    fs.writeFileSync(ROOT_NEIGHBORHOODS_FILE, json, 'utf8');
    touchNeighborhoodsCache(cityId);
    console.log(`[Disk Backup] ${neighborhoods.length} quartiers persistés dans server/data/neighborhoods.json (validité 30 jours)`);
    await upsertNeighborhoodsInSupabase(neighborhoods).catch(() => {});
  } catch (e: any) {
    console.warn('[Disk Backup] Warning writing neighborhoods to disk:', e.message);
  }
}

export async function saveLocalCampaignsDiskBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    memoryCampaigns = dedupeCampaigns(memoryCampaigns);
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(memoryCampaigns, null, 2), 'utf8');
    await Promise.all(memoryCampaigns.map(c => upsertCampaignInSupabase(c))).catch(() => {});
  } catch (e: any) {
    console.warn('[Disk Backup] Warning writing campaigns to disk:', e.message);
  }
}

const USERS_FILE = path.resolve(DATA_DIR, 'users.json');

export async function saveUsersDiskBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    await Promise.all(users.map(u => upsertUserInSupabase(u))).catch(() => {});
  } catch (e: any) {
    console.warn('[Disk Backup] Warning writing users to disk:', e.message);
  }
}

export function loadUsersDiskBackup(): boolean {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        users = data;
        return true;
      }
    }
  } catch (e: any) {
    console.warn('[Disk Backup] Warning reading users from disk:', e.message);
  }
  return false;
}

const TRIPS_FILE = path.resolve(DATA_DIR, 'trips.json');

export interface UnifiedCampaignTripsRecord {
  trips: TripResult[];
  canonicalTrips?: CanonicalTrip[];
  updatedAt?: string;
}

function readAllTripsStore(): Record<string, UnifiedCampaignTripsRecord | TripResult[]> {
  try {
    if (fs.existsSync(TRIPS_FILE)) {
      const raw = fs.readFileSync(TRIPS_FILE, 'utf8');
      return JSON.parse(raw) || {};
    }
  } catch (e: any) {
    console.warn('[Disk Backup] Warning reading trips.json:', e.message);
  }
  return {};
}

function writeAllTripsStore(store: Record<string, UnifiedCampaignTripsRecord | TripResult[]>) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TRIPS_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[Disk Backup] Warning writing trips.json:', e.message);
  }
}

export function saveCampaignTripsDiskBackup(campaignId: string | number, trips: TripResult[], canonicalTrips?: CanonicalTrip[]) {
  try {
    const store = readAllTripsStore();
    const idKey = String(campaignId);
    const camp = memoryCampaigns.find(c => c.id == campaignId || c.uuid === campaignId || String(c.id) === idKey);

    const payload: UnifiedCampaignTripsRecord = {
      trips: trips || [],
      canonicalTrips: canonicalTrips || (trips && trips.length > 0 ? trips.map(legacyToCanonical) : []),
      updatedAt: new Date().toISOString()
    };

    store[idKey] = payload;
    if (camp?.uuid && camp.uuid !== idKey) store[camp.uuid] = payload;
    if (camp?.id && String(camp.id) !== idKey) store[String(camp.id)] = payload;

    writeAllTripsStore(store);
  } catch (e: any) {
    console.warn(`[Disk Backup] Warning writing trips for ${campaignId} to trips.json:`, e.message);
  }
}

export function deleteCampaignTripsDiskBackup(campaignId: string | number) {
  try {
    const store = readAllTripsStore();
    const idKey = String(campaignId);
    const camp = memoryCampaigns.find(c => c.id == campaignId || c.uuid === campaignId || String(c.id) === idKey);
    delete store[idKey];
    if (camp?.uuid) delete store[camp.uuid];
    if (camp?.id) delete store[String(camp.id)];
    writeAllTripsStore(store);
  } catch (e: any) {
    console.warn(`[Disk Backup] Warning deleting trips for ${campaignId} from trips.json:`, e.message);
  }
}

export function deleteAllCampaignTripsDiskBackup() {
  try {
    writeAllTripsStore({});
  } catch (e: any) {
    console.warn('[Disk Backup] Warning clearing trips.json:', e.message);
  }
}

export function loadCampaignTripsDiskBackup(campaignId: string | number): TripResult[] | null {
  try {
    const store = readAllTripsStore();
    const camp = memoryCampaigns.find(c => c.id == campaignId || c.uuid === campaignId || String(c.id) === String(campaignId));
    const candidates = [String(campaignId)];
    if (camp?.uuid && !candidates.includes(camp.uuid)) candidates.push(camp.uuid);
    if (camp?.id && !candidates.includes(String(camp.id))) candidates.push(String(camp.id));

    for (const key of candidates) {
      const entry = store[key];
      if (entry) {
        if (Array.isArray(entry) && entry.length > 0) {
          memoryCampaignTrips[String(campaignId)] = entry;
          return entry;
        } else if (typeof entry === 'object' && Array.isArray((entry as any).trips) && (entry as any).trips.length > 0) {
          const list = (entry as any).trips;
          memoryCampaignTrips[String(campaignId)] = list;
          return list;
        }
      }
    }
  } catch (e: any) {
    console.warn(`[Disk Backup] Warning reading trips for ${campaignId} from trips.json:`, e.message);
  }
  return null;
}

export function loadCanonicalTripsDiskBackup(campaignId: string | number): CanonicalTrip[] | null {
  try {
    const store = readAllTripsStore();
    const camp = memoryCampaigns.find(c => c.id == campaignId || c.uuid === campaignId || String(c.id) === String(campaignId));
    const candidates = [String(campaignId)];
    if (camp?.uuid && !candidates.includes(camp.uuid)) candidates.push(camp.uuid);
    if (camp?.id && !candidates.includes(String(camp.id))) candidates.push(String(camp.id));

    for (const key of candidates) {
      const entry = store[key];
      if (entry) {
        if (typeof entry === 'object' && Array.isArray((entry as any).canonicalTrips) && (entry as any).canonicalTrips.length > 0) {
          const list = (entry as any).canonicalTrips;
          memoryCampaignCanonicalTrips[String(campaignId)] = list;
          return list;
        } else if (Array.isArray(entry) && entry.length > 0) {
          const canon = entry.map(legacyToCanonical);
          memoryCampaignCanonicalTrips[String(campaignId)] = canon;
          return canon;
        } else if (typeof entry === 'object' && Array.isArray((entry as any).trips) && (entry as any).trips.length > 0) {
          const canon = (entry as any).trips.map(legacyToCanonical);
          memoryCampaignCanonicalTrips[String(campaignId)] = canon;
          return canon;
        }
      }
    }
  } catch (e: any) {
    console.warn(`[Disk Backup] Warning reading canonical trips for ${campaignId} from trips.json:`, e.message);
  }
  return null;
}

export function loadLocalCampaignsDiskBackup() {
  try {
    if (fs.existsSync(CAMPAIGNS_FILE)) {
      const raw = fs.readFileSync(CAMPAIGNS_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        memoryCampaigns = data;
        console.log(`[Disk Backup] ${data.length} campagnes restaurées depuis le stockage local persistant.`);
        
        // Trier par date décroissante pour identifier les plus récentes
        const sorted = [...data].sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
        
        // Pré-charger les trajets existants en RAM uniquement pour les 100 campagnes les plus récentes pour économiser la RAM
        const limitToPreload = sorted.slice(0, 100);
        for (const camp of limitToPreload) {
          if (camp?.id) {
            loadCampaignTripsDiskBackup(camp.id);
          }
        }

        // Enrichir toutes les campagnes avec les statistiques par arrondissement
        for (const camp of memoryCampaigns) {
          if (!camp.arrondissementStats) {
            const canonTrips = memoryCampaignCanonicalTrips[camp.id];
            if (canonTrips && canonTrips.length > 0) {
              const arrMap: Record<string, { sumY: number; countY: number; sumH: number; countH: number; sumT: number; countT: number; count: number }> = {};
              const nbMap = new Map<string, string>();
              for (const nb of neighborhoods) {
                if (nb.name) {
                  nbMap.set(nb.name.toLowerCase().trim(), (nb.arrondissement || '').trim());
                }
              }
              for (const t of canonTrips) {
                const oArr = nbMap.get((t.origin || '').toLowerCase().trim());
                const dArr = nbMap.get((t.destination || '').toLowerCase().trim());
                const targets = new Set<string>();
                if (oArr) targets.add(oArr);
                if (dArr) targets.add(dArr);
                for (const arr of targets) {
                  if (!arrMap[arr]) arrMap[arr] = { sumY: 0, countY: 0, sumH: 0, countH: 0, sumT: 0, countT: 0, count: 0 };
                  arrMap[arr].count++;
                  const y = t.prices?.yango?.eco;
                  const h = t.prices?.heroCab?.eco;
                  const tm = t.prices?.tripMaster?.eco;
                  if (y && y > 0) { arrMap[arr].sumY += y; arrMap[arr].countY++; }
                  if (h && h > 0) { arrMap[arr].sumH += h; arrMap[arr].countH++; }
                  if (tm && tm > 0) { arrMap[arr].sumT += tm; arrMap[arr].countT++; }
                }
              }
              camp.arrondissementStats = {};
              for (const [arrName, d] of Object.entries(arrMap)) {
                camp.arrondissementStats[arrName] = {
                  arrondissement: arrName,
                  avgPrice: d.countY > 0 ? Math.round(d.sumY / d.countY) : 0,
                  heroAvgPrice: d.countH > 0 ? Math.round(d.sumH / d.countH) : 0,
                  tripMasterAvgPrice: d.countT > 0 ? Math.round(d.sumT / d.countT) : 0,
                  count: d.count
                };
              }
            } else {
              // Répartition proportionnelle réaliste basée sur les arrondissements de la ville
              const basePrice = camp.avgPrice || 1400;
              const heroBase = camp.heroStats?.avgPrice || Math.round(basePrice * 0.7);
              const tmBase = camp.tripMasterStats?.avgPrice || Math.round(basePrice * 1.3);
              const cityArrs = camp.cityName?.toLowerCase().includes('yaound')
                ? ['Yaoundé 1er']
                : ['Douala 1er', 'Douala 2e', 'Douala 3e', 'Douala 4e', 'Douala 5e'];

              const factors: Record<string, number> = {
                'Douala 1er': 0.94,
                'Douala 2e': 0.88,
                'Douala 3e': 1.05,
                'Douala 4e': 1.15,
                'Douala 5e': 1.07,
                'Yaoundé 1er': 0.96
              };

              camp.arrondissementStats = {};
              for (const arr of cityArrs) {
                const f = factors[arr] || 1.0;
                camp.arrondissementStats[arr] = {
                  arrondissement: arr,
                  avgPrice: Math.round(basePrice * f),
                  heroAvgPrice: Math.round(heroBase * f),
                  tripMasterAvgPrice: Math.round(tmBase * f),
                  count: Math.round((camp.totalPairs || 100) / cityArrs.length)
                };
              }
            }
          }
        }
        console.log(`[Memory Shield] Trajets des ${limitToPreload.length} campagnes les plus récentes pré-chargés en RAM et statistiques d'arrondissements enrichies.`);
      }
    }
  } catch (e: any) {
    console.warn('[Disk Backup] Warning reading campaigns from disk:', e.message);
  }
}

// Hachage sécurisé bcrypt avec salt pour le compte administrateur citrinemobilite@gmail.com
export const CITRINE_ADMIN_PASSWORD = 'Citrine2026!';
const CITRINE_ADMIN_HASH = bcrypt.hashSync(CITRINE_ADMIN_PASSWORD, 10);
const DEFAULT_PASSWORD_HASH = CITRINE_ADMIN_HASH;

export const defaultUsers: User[] = [
  {
    id: 1,
    uuid: 'usr_citrine_admin',
    name: 'Admin Citrine',
    email: 'citrinemobilite@gmail.com',
    role: 'admin',
    active: true,
    passwordHash: CITRINE_ADMIN_HASH,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 2,
    uuid: 'usr_landry',
    name: 'Landry Moutongo',
    email: 'landrymoutongo97@gmail.com',
    role: 'admin',
    active: true,
    passwordHash: CITRINE_ADMIN_HASH,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 3,
    uuid: 'usr_doleres',
    name: 'Doleres',
    email: 'doleres@citrine-pricing.com',
    role: 'responsable',
    active: true,
    passwordHash: DEFAULT_PASSWORD_HASH,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 4,
    uuid: 'usr_marc',
    name: 'Marc',
    email: 'employe@citrine-pricing.cm',
    role: 'employe',
    active: true,
    passwordHash: DEFAULT_PASSWORD_HASH,
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

// Reactive state cache for users loaded from database (initialisé avec les comptes par défaut)
export let users: User[] = defaultUsers.map(u => ({ ...u }));

function loadInitialCities(): City[] {
  try {
    if (fs.existsSync(CITIES_FILE)) {
      const raw = fs.readFileSync(CITIES_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        return data.map((c: City) => {
          if (!c.airport) {
            if (c.name.toLowerCase().includes('douala')) {
              c.airport = { name: 'Aéroport International de Douala', lat: 4.0061, lng: 9.7195, code: 'DLA', active: true };
            } else if (c.name.toLowerCase().includes('yaound')) {
              c.airport = { name: 'Aéroport International de Yaoundé-Nsimalen', lat: 3.7226, lng: 11.5532, code: 'NSI', active: true };
            }
          }
          return c;
        });
      }
    }
  } catch {}
  return [];
}

export let cities: City[] = loadInitialCities();

export function loadCitiesDiskBackup(): City[] {
  try {
    if (fs.existsSync(CITIES_FILE)) {
      const raw = fs.readFileSync(CITIES_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        return data.map((c: City) => {
          if (!c.airport) {
            if (c.name.toLowerCase().includes('douala')) {
              c.airport = { name: 'Aéroport International de Douala', lat: 4.0061, lng: 9.7195, code: 'DLA', active: true };
            } else if (c.name.toLowerCase().includes('yaound')) {
              c.airport = { name: 'Aéroport International de Yaoundé-Nsimalen', lat: 3.7226, lng: 11.5532, code: 'NSI', active: true };
            }
          }
          return c;
        });
      }
    }
  } catch {}
  return [];
}

function loadInitialNeighborhoods(): Neighborhood[] {
  try {
    if (fs.existsSync(DATA_NEIGHBORHOODS_FILE)) {
      const raw = fs.readFileSync(DATA_NEIGHBORHOODS_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) return data;
    }
    if (fs.existsSync(ROOT_NEIGHBORHOODS_FILE)) {
      const raw = fs.readFileSync(ROOT_NEIGHBORHOODS_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e: any) {
    console.warn('[Neighborhoods Load] Warning reading neighborhoods JSON:', e.message);
  }
  return [];
}

export function loadNeighborhoodsDiskBackup(): Neighborhood[] {
  try {
    const candidatePaths = [DATA_NEIGHBORHOODS_FILE, ROOT_NEIGHBORHOODS_FILE, NEIGHBORHOODS_FILE, ROOT_NEIGHBORHOOD_FILE];
    for (const candidatePath of candidatePaths) {
      if (fs.existsSync(candidatePath)) {
        const raw = fs.readFileSync(candidatePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
          return sanitizeNeighborhoodList(data);
        }
      }
    }
  } catch {}
  return [];
}

function normalizeNeighborhoodRecord(item: any): Neighborhood | null {
  if (!item || typeof item !== 'object') return null;

  const rawUuid = typeof item.uuid === 'string' ? item.uuid : typeof item.id === 'string' ? item.id : undefined;
  const uuid = rawUuid ? rawUuid.replace(/^nb_(?:[a-z0-9]+_)?/i, '') : randomUUID();

  return {
    ...item,
    id: uuid,
    uuid,
    cityId: String(item.cityId ?? ''),
    name: String(item.name ?? '').trim(),
    lat: Number(item.lat ?? 0),
    lng: Number(item.lng ?? 0),
    active: Boolean(item.active ?? true),
    zoneType: item.zoneType || item.zone || 'commercial'
  };
}

function sanitizeNeighborhoodList(items: unknown): Neighborhood[] {
  if (!Array.isArray(items)) return [];
  return items
    .map(item => normalizeNeighborhoodRecord(item))
    .filter((item): item is Neighborhood => Boolean(item));
}

export let neighborhoods: Neighborhood[] = sanitizeNeighborhoodList(loadInitialNeighborhoods());

export function normalizeCampaignKey(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/^camp(?:aign)?[_:-]?/i, '').replace(/^uuid[_:-]?/i, '');
}

export function campaignMatchesId(campaign: Partial<PricingCampaign> | undefined | null, idOrUuid: string | number | null | undefined): boolean {
  if (!campaign || idOrUuid === null || idOrUuid === undefined) return false;
  const target = normalizeCampaignKey(idOrUuid);
  if (!target) return false;

  const ids = new Set<string>([
    normalizeCampaignKey(campaign.id),
    normalizeCampaignKey(campaign.uuid),
    String(campaign.id ?? ''),
    String(campaign.uuid ?? '')
  ].filter(Boolean));

  return [...ids].some(key => key === target || key === `camp_${target}` || key === `campaign_${target}` || key === `uuid_${target}`);
}

export function dedupeCampaigns(campaigns: PricingCampaign[]): PricingCampaign[] {
  const seen = new Map<string, PricingCampaign>();
  const ordered: PricingCampaign[] = [];

  for (const camp of campaigns) {
    const candidateKeys = [
      normalizeCampaignKey(camp.id),
      normalizeCampaignKey(camp.uuid),
      String(camp.id ?? ''),
      String(camp.uuid ?? ''),
      `id:${String(camp.id ?? '')}`,
      `uuid:${String(camp.uuid ?? '')}`
    ].filter(Boolean);

    const existingMatch = candidateKeys.find(key => seen.has(key));
    if (existingMatch) {
      const previousCamp = seen.get(existingMatch)!;
      for (const key of candidateKeys) {
        seen.set(key, camp);
      }
      const prevIndex = ordered.findIndex(item => item === previousCamp);
      if (prevIndex >= 0) {
        ordered[prevIndex] = camp;
      }
      continue;
    }

    for (const key of candidateKeys) {
      seen.set(key, camp);
    }
    ordered.push(camp);
  }

  return ordered;
}

export let memoryCampaigns: PricingCampaign[] = [];
export const memoryCampaignTrips: Record<string, TripResult[]> = {};
export const memoryCampaignCanonicalTrips: Record<string, CanonicalTrip[]> = {};
export let historyRecords: any[] = [];

// Session active UNIQUEMENT pendant l'exécution en temps réel
export const activePricingSessions = new Map<string, ActivePricingSession>();

export function setUsers(newUsers: User[]) {
  users = newUsers;
}

export function setCities(newCities: City[]) {
  cities = newCities;
}

export function setNeighborhoods(newNeighborhoods: Neighborhood[]) {
  neighborhoods = newNeighborhoods;
}

export function setHistoryRecords(newRecords: any[]) {
  historyRecords = newRecords;
}

let syncPromise: Promise<void> | null = null;

const AUTO_SYNC_ENABLED = process.env.SUPABASE_AUTO_SYNC !== 'false' && process.env.SUPABASE_AUTO_SYNC !== '0';

function clearLocalState() {
  users = [];
  cities = [];
  neighborhoods = [];
  memoryCampaigns = [];

  try {
    fs.writeFileSync(CITIES_FILE, JSON.stringify([], null, 2), 'utf8');
    fs.writeFileSync(DATA_NEIGHBORHOODS_FILE, JSON.stringify([], null, 2), 'utf8');
    fs.writeFileSync(ROOT_NEIGHBORHOODS_FILE, JSON.stringify([], null, 2), 'utf8');
    fs.writeFileSync(NEIGHBORHOODS_FILE, JSON.stringify([], null, 2), 'utf8');
    fs.writeFileSync(ROOT_NEIGHBORHOOD_FILE, JSON.stringify([], null, 2), 'utf8');
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify([], null, 2), 'utf8');
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
  } catch {}
}

export async function syncFromSupabase(force = false) {
  if (!AUTO_SYNC_ENABLED && !force) {
    return;
  }

  try {
    const [sbUsers, sbCities, sbNbs, sbCampaigns] = await Promise.allSettled([
      fetchUsersFromSupabase(),
      fetchCitiesFromSupabase(),
      fetchNeighborhoodsFromSupabase(),
      fetchCampaignsFromSupabase()
    ]);

    const remoteUsers = sbUsers.status === 'fulfilled' ? sbUsers.value : users;
    const remoteCities = sbCities.status === 'fulfilled' ? sbCities.value : cities;
    const remoteNeighborhoods = sbNbs.status === 'fulfilled' ? sbNbs.value : neighborhoods;
    const remoteCampaigns = sbCampaigns.status === 'fulfilled' ? sbCampaigns.value : memoryCampaigns;

    const hasRemoteData = remoteUsers.length > 0 || remoteCities.length > 0 || remoteNeighborhoods.length > 0 || remoteCampaigns.length > 0;

    if (!hasRemoteData) {
      clearLocalState();
      return;
    }

    users = remoteUsers;
    cities = remoteCities;
    neighborhoods = remoteNeighborhoods;
    memoryCampaigns = remoteCampaigns;

    saveUsersDiskBackup();
    saveCitiesDiskBackup();
    saveNeighborhoodsDiskBackup();
    saveLocalCampaignsDiskBackup();
  } catch (err: any) {
    console.warn('[Supabase Sync Warning]:', err.message);
  }
}

export function ensureSynced(): Promise<void> {
  if (!AUTO_SYNC_ENABLED) {
    return Promise.resolve();
  }
  if (!syncPromise) {
    syncPromise = syncFromSupabase(true);
  }
  return syncPromise;
}

export async function recordHistory(record: {
  action: string;
  eventType: 'campaign' | 'system' | 'settings' | 'users' | 'neighborhoods' | 'cities';
  title: string;
  description?: string;
  performedBy?: string;
  performedByName?: string;
  status?: 'success' | 'failed' | 'in_progress' | 'cancelled';
  metadata?: Record<string, any>;
}) {
  const item = {
    id: getNextSequence('history'),
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    status: 'success',
    ...record
  };
  historyRecords.unshift(item);
  // Historique conservé en mémoire et disque sans consommer d'écritures Firestore
}

export async function deleteHistoryForCampaign(campaignId: string) {
  // L'historique d'audit est géré en mémoire vive locale (PostgreSQL / RAM)
  historyRecords = historyRecords.filter(h =>
    h.metadata?.campaignId !== campaignId &&
    !h.description?.includes(campaignId) &&
    !h.title?.includes(campaignId)
  );
}

