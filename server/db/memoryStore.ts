import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { User, City, Neighborhood, PricingCampaign, TripResult, ActivePricingSession, CanonicalTrip } from '../types.js';
import { db, cleanFirestoreDoc, safeFirestoreWrite } from './firestore.js';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// Hachage sécurisé bcrypt avec salt pour l'administrateur
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('c!tr!n$@2026', 10);

// In-memory fallback and reactive state cache
export let users: User[] = [
  {
    id: 'usr_citrine_admin',
    name: 'Citrine Mobilité (Super Admin)',
    email: 'citrinemobilite@gmail.com',
    role: 'admin',
    active: true,
    passwordHash: DEFAULT_PASSWORD_HASH,
    createdAt: new Date().toISOString()
  },
  {
    id: 'user_responsable_default',
    name: 'Responsable Opérations',
    email: 'responsable@citrine-pricing.cm',
    role: 'responsable',
    active: true,
    passwordHash: DEFAULT_PASSWORD_HASH,
    createdAt: new Date().toISOString()
  }
];

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

export let neighborhoods: Neighborhood[] = [
  { id: 'nb_dla_akwa', cityId: 'city_douala', name: 'Akwa', lat: 4.0503, lng: 9.7042, active: true, zoneType: 'commercial' },
  { id: 'nb_dla_bonanjo', cityId: 'city_douala', name: 'Bonanjo', lat: 4.0433, lng: 9.6892, active: true, zoneType: 'center' },
  { id: 'nb_dla_bonapriso', cityId: 'city_douala', name: 'Bonapriso', lat: 4.0270, lng: 9.7020, active: true, zoneType: 'residential' },
  { id: 'nb_dla_deido', cityId: 'city_douala', name: 'Deido', lat: 4.0670, lng: 9.7120, active: true, zoneType: 'popular' },
  { id: 'nb_dla_bali', cityId: 'city_douala', name: 'Bali', lat: 4.0380, lng: 9.6970, active: true, zoneType: 'residential' },
  { id: 'nb_dla_makepe', cityId: 'city_douala', name: 'Makèpè', lat: 4.0840, lng: 9.7420, active: true, zoneType: 'residential' },
  { id: 'nb_dla_bepanda', cityId: 'city_douala', name: 'Bépanda', lat: 4.0620, lng: 9.7300, active: true, zoneType: 'popular' },
  { id: 'nb_dla_ndogbong', cityId: 'city_douala', name: 'Ndogbong', lat: 4.0530, lng: 9.7480, active: true, zoneType: 'commercial' }
];

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
  if (!db) return;
  try {
    const [usersRes, citiesRes, nbsRes, historyRes] = await Promise.allSettled([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'cities')),
      getDocs(collection(db, 'neighborhoods')),
      getDocs(collection(db, 'history'))
    ]);

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
