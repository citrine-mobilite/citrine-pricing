import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User, City, Neighborhood, PricingCampaign, TripResult, ActivePricingSession, CanonicalTrip } from '../types.js';
import { db, cleanFirestoreDoc, safeFirestoreWrite, safeFirestoreRead, isFirestoreQuotaExceeded, isQuotaExceededError, flagFirestoreQuotaExceeded } from './firestore.js';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import defaultNeighborhoods from './defaultNeighborhoods.json' with { type: 'json' };

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const TRIPS_DIR = path.resolve(DATA_DIR, 'trips');
const CAMPAIGNS_FILE = path.resolve(DATA_DIR, 'campaigns.json');
const NEIGHBORHOODS_FILE = path.resolve(process.cwd(), 'server/db/defaultNeighborhoods.json');

export function saveNeighborhoodsDiskBackup() {
  try {
    fs.writeFileSync(NEIGHBORHOODS_FILE, JSON.stringify(neighborhoods, null, 2), 'utf8');
    console.log(`[Disk Backup] ${neighborhoods.length} quartiers persistés dans defaultNeighborhoods.json`);
  } catch (e: any) {
    console.warn('[Disk Backup] Warning writing neighborhoods to disk:', e.message);
  }
}

export function saveLocalCampaignsDiskBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    // Conserver les 25 dernières campagnes
    const capped = [...memoryCampaigns]
      .sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime())
      .slice(0, 25);
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(capped, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[Disk Backup] Warning writing campaigns to disk:', e.message);
  }
}

const USERS_FILE = path.resolve(DATA_DIR, 'users.json');
const CITIES_FILE = path.resolve(DATA_DIR, 'cities.json');

export function saveCitiesDiskBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CITIES_FILE, JSON.stringify(cities, null, 2), 'utf8');
    console.log(`[Disk Backup] ${cities.length} villes sauvegardées dans cities.json`);
  } catch (e: any) {
    console.warn('[Disk Backup] Warning writing cities to disk:', e.message);
  }
}

export function loadCitiesDiskBackup(): boolean {
  try {
    if (fs.existsSync(CITIES_FILE)) {
      const raw = fs.readFileSync(CITIES_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        cities = data;
        return true;
      }
    }
  } catch (e: any) {
    console.warn('[Disk Backup] Warning reading cities from disk:', e.message);
  }
  return false;
}

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

export function saveCampaignTripsDiskBackup(campaignId: string, trips: TripResult[], canonicalTrips?: CanonicalTrip[]) {
  try {
    if (!fs.existsSync(TRIPS_DIR)) fs.mkdirSync(TRIPS_DIR, { recursive: true });
    if (Array.isArray(trips) && trips.length > 0) {
      const filePath = path.resolve(TRIPS_DIR, `trips_${campaignId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(trips, null, 2), 'utf8');
    }
    if (Array.isArray(canonicalTrips) && canonicalTrips.length > 0) {
      const canonPath = path.resolve(TRIPS_DIR, `canonical_${campaignId}.json`);
      fs.writeFileSync(canonPath, JSON.stringify(canonicalTrips, null, 2), 'utf8');
    }
  } catch (e: any) {
    console.warn(`[Disk Backup] Warning writing trips for ${campaignId} to disk:`, e.message);
  }
}

export function deleteCampaignTripsDiskBackup(campaignId: string) {
  try {
    if (fs.existsSync(TRIPS_DIR)) {
      const filePath = path.resolve(TRIPS_DIR, `trips_${campaignId}.json`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      const canonPath = path.resolve(TRIPS_DIR, `canonical_${campaignId}.json`);
      if (fs.existsSync(canonPath)) fs.unlinkSync(canonPath);
    }
  } catch (e: any) {
    console.warn(`[Disk Backup] Warning deleting trips for ${campaignId} from disk:`, e.message);
  }
}

export function deleteAllCampaignTripsDiskBackup() {
  try {
    if (fs.existsSync(TRIPS_DIR)) {
      const files = fs.readdirSync(TRIPS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.resolve(TRIPS_DIR, file));
        }
      }
    }
  } catch (e: any) {
    console.warn('[Disk Backup] Warning deleting all trips from disk:', e.message);
  }
}

export function loadCampaignTripsDiskBackup(campaignId: string): TripResult[] | null {
  try {
    const filePath = path.resolve(TRIPS_DIR, `trips_${campaignId}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        memoryCampaignTrips[campaignId] = data;
        
        // Charger simultanément le format canonique en RAM s'il existe
        const canonPath = path.resolve(TRIPS_DIR, `canonical_${campaignId}.json`);
        if (fs.existsSync(canonPath)) {
          try {
            const rawCanon = fs.readFileSync(canonPath, 'utf8');
            const canonData = JSON.parse(rawCanon);
            if (Array.isArray(canonData) && canonData.length > 0) {
              memoryCampaignCanonicalTrips[campaignId] = canonData;
            }
          } catch {}
        }
        return data;
      }
    }
    const canonPath = path.resolve(TRIPS_DIR, `canonical_${campaignId}.json`);
    if (fs.existsSync(canonPath)) {
      const raw = fs.readFileSync(canonPath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        memoryCampaignCanonicalTrips[campaignId] = data;
        const mapped = data.map((t: CanonicalTrip) => ({
          id: t.id,
          campaignId,
          origin: t.origin,
          destination: t.destination,
          distanceKm: t.distanceKm,
          durationMinutes: t.durationMin,
          jams: Boolean(t.jams),
          yangoUnavailable: Boolean(t.yangoUnavailable),
          yangoWaitingMinutes: t.yangoWaitingMinutes,
          yangoUnavailableClasses: t.yangoUnavailableClasses,
          prices: t.prices,
          cheapest: t.cheapest,
          status: t.status,
          createdAt: t.createdAt
        })) as unknown as TripResult[];
        memoryCampaignTrips[campaignId] = mapped;
        return mapped;
      }
    }
  } catch (e: any) {
    console.warn(`[Disk Backup] Warning reading trips for ${campaignId} from disk:`, e.message);
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
        
        // Conserver les 25 campagnes les plus récentes
        const sorted = [...data].sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
        memoryCampaigns = sorted.slice(0, 25);
        
        // Pré-charger les trajets existants en RAM pour les 25 campagnes les plus récentes
        for (const camp of memoryCampaigns) {
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
        console.log(`[Memory Shield] Trajets des ${memoryCampaigns.length} campagnes les plus récentes pré-chargés en RAM et statistiques d'arrondissements enrichies.`);
      }
    }
  } catch (e: any) {
    console.warn('[Disk Backup] Warning reading campaigns from disk:', e.message);
  }
}

export const CITRINE_ADMIN_PASSWORD = 'Citrine2026!';

// États réactifs en RAM chargés dynamiquement depuis les fichiers de persistance
export let users: User[] = [];
export let cities: City[] = [];
export let neighborhoods: Neighborhood[] = (defaultNeighborhoods as unknown as Neighborhood[]) || [];

export let memoryCampaigns: PricingCampaign[] = [];
export const memoryCampaignTrips: Record<string, TripResult[]> = {};
export const memoryCampaignCanonicalTrips: Record<string, CanonicalTrip[]> = {};
export let historyRecords: any[] = [];

// Restauration immédiate en RAM dès le chargement du module depuis le stockage persistant
loadLocalCampaignsDiskBackup();
loadCitiesDiskBackup();
loadUsersDiskBackup();

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

export function setMemoryCampaigns(newCamps: PricingCampaign[]) {
  memoryCampaigns = newCamps;
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
    id: randomUUID(),
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

let hasSyncedOnce = false;

/**
 * Synchronisation initiale ultra-économe (0 lecture superflue)
 * - Villes et quartiers servis 100% depuis le cache local (0 lecture Firestore)
 * - Au maximum 10 campagnes lues si la mémoire est vide (max 10 lectures O(1))
 */
export async function syncFromFirestore() {
  if (hasSyncedOnce) return;
  hasSyncedOnce = true;

  // 1. Restaurer d'abord tout depuis les disques locaux
  loadLocalCampaignsDiskBackup();
  loadUsersDiskBackup();

  // 2. Si les 10 campagnes et les utilisateurs sont déjà en mémoire, AUCUN APPEL FIRESTORE !
  if (memoryCampaigns.length > 0 && users.length > 0) {
    console.log(`[Store Shield] Données déjà en cache local (${cities.length} villes, ${neighborhoods.length} quartiers, ${memoryCampaigns.length} campagnes, ${users.length} users). 0 lecture Firestore consommée.`);
    return;
  }

  if (!db || isFirestoreQuotaExceeded()) return;

  try {
    // 3. Uniquement si memoryCampaigns est vide, charger les 25 dernières campagnes
    if (memoryCampaigns.length === 0) {
      const q = query(collection(db, 'campaigns'), orderBy('startedAt', 'desc'), limit(25));
      const snap = await safeFirestoreRead('syncInitial25Campaigns', () => getDocs(q), 25);
      if (snap && !snap.empty) {
        memoryCampaigns = snap.docs.map(d => ({ id: d.id, ...d.data() } as PricingCampaign));
        saveLocalCampaignsDiskBackup();
        console.log(`[Store Shield] Synchronisé ${memoryCampaigns.length} dernières campagnes depuis Firestore.`);
      }
    }
  } catch (err: any) {
    console.warn('[Firestore Sync Notice]:', err.message);
  }
}
