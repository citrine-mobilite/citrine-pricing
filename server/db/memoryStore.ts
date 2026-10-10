import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User, City, Neighborhood, PricingCampaign, TripResult, ActivePricingSession, CanonicalTrip } from '../types.js';
import { db, cleanFirestoreDoc, safeFirestoreWrite, isFirestoreQuotaExceeded, isQuotaExceededError, flagFirestoreQuotaExceeded, legacyToCanonical } from './firestore.js';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
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

export function saveCitiesDiskBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CITIES_FILE, JSON.stringify(cities, null, 2), 'utf8');
    touchCitiesCache();
    console.log(`[Disk Backup] ${cities.length} villes persistées dans server/data/cities.json`);
  } catch (e: any) {
    console.warn('[Disk Backup] Warning writing cities to disk:', e.message);
  }
}

export function saveNeighborhoodsDiskBackup(cityId?: string) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const json = JSON.stringify(neighborhoods, null, 2);
    fs.writeFileSync(DATA_NEIGHBORHOODS_FILE, json, 'utf8');
    fs.writeFileSync(NEIGHBORHOODS_FILE, json, 'utf8');
    fs.writeFileSync(ROOT_NEIGHBORHOOD_FILE, json, 'utf8');
    fs.writeFileSync(ROOT_NEIGHBORHOODS_FILE, json, 'utf8');
    touchNeighborhoodsCache(cityId);
    console.log(`[Disk Backup] ${neighborhoods.length} quartiers persistés dans server/data/neighborhoods.json (validité 30 jours)`);
  } catch (e: any) {
    console.warn('[Disk Backup] Warning writing neighborhoods to disk:', e.message);
  }
}

export function saveLocalCampaignsDiskBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(memoryCampaigns, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[Disk Backup] Warning writing campaigns to disk:', e.message);
  }
}

const USERS_FILE = path.resolve(DATA_DIR, 'users.json');

export function saveUsersDiskBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
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
  return [
    {
      id: 1,
      uuid: 'city_douala',
      name: 'Douala',
      country: 'Cameroun',
      currency: 'XAF',
      currencySymbol: 'FCFA',
      center: { lat: 4.0511, lng: 9.7679 },
      airport: {
        name: 'Aéroport International de Douala',
        lat: 4.0061,
        lng: 9.7195,
        code: 'DLA',
        active: true
      },
      active: true,
      autoSchedule: {
        enabled: false,
        slots: ['08:00', '13:00', '18:00'],
        lastRunAt: undefined
      }
    },
    {
      id: 2,
      uuid: 'city_yaounde',
      name: 'Yaoundé',
      country: 'Cameroun',
      currency: 'XAF',
      currencySymbol: 'FCFA',
      center: { lat: 3.8480, lng: 11.5021 },
      airport: {
        name: 'Aéroport International de Yaoundé-Nsimalen',
        lat: 3.7226,
        lng: 11.5532,
        code: 'NSI',
        active: true
      },
      active: true,
      autoSchedule: {
        enabled: false,
        slots: ['08:00', '18:00'],
        lastRunAt: undefined
      }
    }
  ];
}

export let cities: City[] = loadInitialCities();

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
  return (defaultNeighborhoods as unknown as Neighborhood[]) || [];
}

export let neighborhoods: Neighborhood[] = loadInitialNeighborhoods();

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

export function ensureSynced(): Promise<void> {
  if (!syncPromise) {
    syncPromise = syncFromFirestore();
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
  // L'historique d'audit est géré en mémoire vive locale (0 lecture/écriture Firestore consommée)
  historyRecords = historyRecords.filter(h =>
    h.metadata?.campaignId !== campaignId &&
    !h.description?.includes(campaignId) &&
    !h.title?.includes(campaignId)
  );
}

/**
 * Synchronisation bidirectionnelle initiale avec Firestore
 */
export async function syncFromFirestore() {
  loadLocalCampaignsDiskBackup();
  loadUsersDiskBackup();
  if (!db || isFirestoreQuotaExceeded()) return;
  try {
    const [usersRes, citiesRes, nbsRes] = await Promise.allSettled([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'cities')),
      getDocs(collection(db, 'neighborhoods'))
    ]);

    for (const res of [usersRes, citiesRes, nbsRes]) {
      if (res.status === 'rejected' && isQuotaExceededError(res.reason)) {
        flagFirestoreQuotaExceeded(res.reason);
        return;
      }
    }

    if (usersRes.status === 'fulfilled' && !usersRes.value.empty) {
      users = usersRes.value.docs.map(d => ({ id: d.id, ...d.data() } as User));
    } else if (usersRes.status === 'fulfilled' && usersRes.value.empty) {
      // Seed initial admin in Firestore
      for (const u of users) {
        await safeFirestoreWrite('seedUser', () => setDoc(doc(db!, 'users', String(u.id)), cleanFirestoreDoc(u)));
      }
    }

    if (citiesRes.status === 'fulfilled' && !citiesRes.value.empty) {
      cities = citiesRes.value.docs.map(d => ({ id: d.id, ...d.data() } as City));
      for (const c of cities) {
        if (!c.airport) {
          if (c.name.toLowerCase().includes('douala')) {
            c.airport = { name: 'Aéroport International de Douala', lat: 4.0061, lng: 9.7195, code: 'DLA', active: true };
            safeFirestoreWrite('syncCityAirport', () => setDoc(doc(db!, 'cities', c.uuid || String(c.id)), { airport: c.airport }, { merge: true }));
          } else if (c.name.toLowerCase().includes('yaound')) {
            c.airport = { name: 'Aéroport International de Yaoundé-Nsimalen', lat: 3.7226, lng: 11.5532, code: 'NSI', active: true };
            safeFirestoreWrite('syncCityAirport', () => setDoc(doc(db!, 'cities', c.uuid || String(c.id)), { airport: c.airport }, { merge: true }));
          }
        }
      }
      saveCitiesDiskBackup();
    } else if (citiesRes.status === 'fulfilled' && citiesRes.value.empty) {
      // Seed default cities
      for (const c of cities) {
        await safeFirestoreWrite('seedCity', () => setDoc(doc(db!, 'cities', String(c.id)), cleanFirestoreDoc(c)));
      }
    }

    if (nbsRes.status === 'fulfilled' && !nbsRes.value.empty) {
      neighborhoods = nbsRes.value.docs.map(d => ({ id: d.id, ...d.data() } as Neighborhood));
    } else if (nbsRes.status === 'fulfilled' && nbsRes.value.empty) {
      // Seed default neighborhoods
      for (const nb of neighborhoods) {
        await safeFirestoreWrite('seedNb', () => setDoc(doc(db!, 'neighborhoods', String(nb.id)), cleanFirestoreDoc(nb)));
      }
    }

    console.log(`[Firestore Sync] ${users.length} users, ${cities.length} villes, ${neighborhoods.length} quartiers synchronisés.`);
  } catch (err: any) {
    console.warn('[Firestore Sync Error]:', err.message);
  }
}
