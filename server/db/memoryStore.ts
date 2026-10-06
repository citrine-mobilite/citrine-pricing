import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User, City, Neighborhood, PricingCampaign, TripResult, ActivePricingSession, CanonicalTrip } from '../types.js';
import { db, cleanFirestoreDoc, safeFirestoreWrite, isFirestoreQuotaExceeded, isQuotaExceededError, flagFirestoreQuotaExceeded } from './firestore.js';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import defaultNeighborhoods from './defaultNeighborhoods.json' with { type: 'json' };

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const TRIPS_DIR = path.resolve(DATA_DIR, 'trips');
const CAMPAIGNS_FILE = path.resolve(DATA_DIR, 'campaigns.json');

export function saveLocalCampaignsDiskBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(memoryCampaigns, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[Disk Backup] Warning writing campaigns to disk:', e.message);
  }
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

export function loadCampaignTripsDiskBackup(campaignId: string): TripResult[] | null {
  try {
    const filePath = path.resolve(TRIPS_DIR, `trips_${campaignId}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        memoryCampaignTrips[campaignId] = data;
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
        
        // Trier par date décroissante pour identifier les plus récentes
        const sorted = [...data].sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
        
        // Pré-charger les trajets existants en RAM uniquement pour les 100 campagnes les plus récentes pour économiser la RAM
        const limitToPreload = sorted.slice(0, 100);
        for (const camp of limitToPreload) {
          if (camp?.id) {
            loadCampaignTripsDiskBackup(camp.id);
          }
        }
        console.log(`[Memory Shield] Trajets des ${limitToPreload.length} campagnes les plus récentes pré-chargés en RAM. Les plus anciennes restent sur le disque et seront chargées instantanément à la demande.`);
      }
    }
  } catch (e: any) {
    console.warn('[Disk Backup] Warning reading campaigns from disk:', e.message);
  }
}

// Hachage sécurisé bcrypt avec salt pour l'administrateur
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('c!tr!n$@2026', 10);

// Reactive state cache for users loaded from database
export let users: User[] = [];

export let cities: City[] = [
  {
    id: 'city_douala',
    name: 'Douala',
    country: 'Cameroun',
    currency: 'XAF',
    currencySymbol: 'FCFA',
    center: { lat: 4.0511, lng: 9.7679 },
    active: true,
    autoSchedule: {
      enabled: false,
      slots: ['08:00', '13:00', '18:00'],
      lastRunAt: undefined
    }
  },
  {
    id: 'city_yaounde',
    name: 'Yaoundé',
    country: 'Cameroun',
    currency: 'XAF',
    currencySymbol: 'FCFA',
    center: { lat: 3.8480, lng: 11.5021 },
    active: true,
    autoSchedule: {
      enabled: false,
      slots: ['08:00', '18:00'],
      lastRunAt: undefined
    }
  }
];

export let neighborhoods: Neighborhood[] = (defaultNeighborhoods as unknown as Neighborhood[]) || [];

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
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    status: 'success',
    ...record
  };
  historyRecords.unshift(item);
  await safeFirestoreWrite('recordHistory', () => setDoc(doc(db!, 'history', item.id), cleanFirestoreDoc(item)));
}

export async function deleteHistoryForCampaign(campaignId: string) {
  historyRecords = historyRecords.filter(h =>
    h.metadata?.campaignId !== campaignId &&
    !h.description?.includes(campaignId) &&
    !h.title?.includes(campaignId)
  );

  if (db) {
    try {
      const snap = await getDocs(collection(db, 'history'));
      const toDelete = snap.docs.filter(d => {
        const data = d.data();
        return data.metadata?.campaignId === campaignId ||
               data.description?.includes(campaignId) ||
               data.title?.includes(campaignId);
      });
      for (const d of toDelete) {
        await safeFirestoreWrite('deleteHistoryItem', () => deleteDoc(doc(db!, 'history', d.id)));
      }
    } catch (e) {
      console.error('Error deleting related history for campaign:', e);
    }
  }
}

/**
 * Synchronisation bidirectionnelle initiale avec Firestore
 */
export async function syncFromFirestore() {
  loadLocalCampaignsDiskBackup();
  if (!db || isFirestoreQuotaExceeded()) return;
  try {
    const [usersRes, citiesRes, nbsRes, historyRes] = await Promise.allSettled([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'cities')),
      getDocs(collection(db, 'neighborhoods')),
      getDocs(collection(db, 'history'))
    ]);

    for (const res of [usersRes, citiesRes, nbsRes, historyRes]) {
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
        await safeFirestoreWrite('seedUser', () => setDoc(doc(db!, 'users', u.id), cleanFirestoreDoc(u)));
      }
    }

    if (citiesRes.status === 'fulfilled' && !citiesRes.value.empty) {
      cities = citiesRes.value.docs.map(d => ({ id: d.id, ...d.data() } as City));
    } else if (citiesRes.status === 'fulfilled' && citiesRes.value.empty) {
      // Seed default cities
      for (const c of cities) {
        await safeFirestoreWrite('seedCity', () => setDoc(doc(db!, 'cities', c.id), cleanFirestoreDoc(c)));
      }
    }

    if (nbsRes.status === 'fulfilled' && !nbsRes.value.empty) {
      neighborhoods = nbsRes.value.docs.map(d => ({ id: d.id, ...d.data() } as Neighborhood));
    } else if (nbsRes.status === 'fulfilled' && nbsRes.value.empty) {
      // Seed default neighborhoods
      for (const nb of neighborhoods) {
        await safeFirestoreWrite('seedNb', () => setDoc(doc(db!, 'neighborhoods', nb.id), cleanFirestoreDoc(nb)));
      }
    }

    if (historyRes.status === 'fulfilled' && !historyRes.value.empty) {
      historyRecords = historyRes.value.docs.map(d => ({ id: d.id, ...d.data() }));
      historyRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    console.log(`[Firestore Sync] ${users.length} users, ${cities.length} villes, ${neighborhoods.length} quartiers synchronisés.`);
  } catch (err: any) {
    console.warn('[Firestore Sync Error]:', err.message);
  }
}
