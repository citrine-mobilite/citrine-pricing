/**
 * Client-Side PWA IndexedDB Cache
 * Garantit 0 lecture Firestore et affichage instantané des trajets déjà consultés
 * Fonctionne hors-ligne et persiste sur mobile et PC.
 */

const DB_NAME = 'citrine_pwa_cache_v1';
const DB_VERSION = 1;
const STORE_TRIPS = 'campaign_trips';
const STORE_COMPARISONS = 'temporal_comparisons';

// In-memory fallback if IndexedDB is blocked
const memoryFallback = new Map<string, any>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TRIPS)) {
        db.createObjectStore(STORE_TRIPS, { keyPath: 'campaignId' });
      }
      if (!db.objectStoreNames.contains(STORE_COMPARISONS)) {
        db.createObjectStore(STORE_COMPARISONS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Récupère les trajets d'une campagne depuis l'IndexedDB locale du téléphone / PC
 */
export async function getCachedCampaignTrips(campaignId: string): Promise<any[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_TRIPS, 'readonly');
      const store = transaction.objectStore(STORE_TRIPS);
      const req = store.get(campaignId);

      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.trips) && req.result.trips.length > 0) {
          resolve(req.result.trips);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        resolve(memoryFallback.get(`trips_${campaignId}`) || null);
      };
    });
  } catch {
    return memoryFallback.get(`trips_${campaignId}`) || null;
  }
}

/**
 * Enregistre les trajets d'une campagne dans l'IndexedDB locale
 */
export async function setCachedCampaignTrips(campaignId: string, trips: any[]): Promise<void> {
  if (!trips || trips.length === 0) return;
  memoryFallback.set(`trips_${campaignId}`, trips);

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_TRIPS, 'readwrite');
      const store = transaction.objectStore(STORE_TRIPS);
      store.put({
        campaignId,
        trips,
        count: trips.length,
        cachedAt: Date.now()
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  } catch {
    // Memory fallback already set
  }
}

/**
 * Supprime le cache d'une campagne (ex: relance ou suppression)
 */
export async function invalidateCampaignTripsCache(campaignId: string): Promise<void> {
  memoryFallback.delete(`trips_${campaignId}`);
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_TRIPS, 'readwrite');
      const store = transaction.objectStore(STORE_TRIPS);
      store.delete(campaignId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  } catch {}
}

/**
 * Récupère une comparaison temporelle mise en cache jusqu'à minuit
 */
export async function getTemporalComparisonCache(key: string): Promise<any | null> {
  const now = Date.now();
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_COMPARISONS, 'readonly');
      const store = transaction.objectStore(STORE_COMPARISONS);
      const req = store.get(key);

      req.onsuccess = () => {
        if (req.result && req.result.expiresAt > now) {
          resolve(req.result.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        const mem = memoryFallback.get(`comp_${key}`);
        if (mem && mem.expiresAt > now) resolve(mem.data);
        else resolve(null);
      };
    });
  } catch {
    const mem = memoryFallback.get(`comp_${key}`);
    if (mem && mem.expiresAt > now) return mem.data;
    return null;
  }
}

/**
 * Enregistre une comparaison temporelle avec expiration à minuit ce soir
 */
export async function setTemporalComparisonCache(key: string, data: any): Promise<void> {
  // Calcul du timestamp de minuit ce soir
  const midnight = new Date();
  midnight.setHours(23, 59, 59, 999);
  const expiresAt = midnight.getTime();

  memoryFallback.set(`comp_${key}`, { data, expiresAt });

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_COMPARISONS, 'readwrite');
      const store = transaction.objectStore(STORE_COMPARISONS);
      store.put({
        key,
        data,
        expiresAt,
        cachedAt: Date.now()
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  } catch {}
}
