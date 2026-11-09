/**
 * Désactivation totale du cache local client (IndexedDB & LocalStorage)
 * Conformément à la consigne : 0 cache applicatif, 100% requêtes directes en base de données MySQL.
 */

// Nettoyage immédiat au chargement de l'application
if (typeof window !== 'undefined') {
  try {
    if (window.indexedDB && window.indexedDB.deleteDatabase) {
      window.indexedDB.deleteDatabase('citrine_pwa_cache_v2');
      window.indexedDB.deleteDatabase('citrine_pwa_cache');
    }
  } catch {}

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('citrine_') ||
         key.startsWith('trips_') ||
         key.startsWith('cache_'))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
}

/**
 * 0 cache - Toujours null pour forcer la requête en direct sur la base de données
 */
export async function getCachedCampaignTrips(_campaignId: string): Promise<any[] | null> {
  return null;
}

export async function setCachedCampaignTrips(_campaignId: string, _trips: any[]): Promise<void> {
  // Aucun stockage en cache local
}

export async function invalidateCampaignTripsCache(_campaignId: string): Promise<void> {}
export async function invalidateAllTripsCache(): Promise<void> {}

export function getCachedCities(): any[] | null {
  return null;
}
export function setCachedCities(_cities: any[]): void {}
export function invalidateCitiesCache(): void {}

export function getCachedNeighborhoods(_cityId?: string | number): any[] | null {
  return null;
}
export function setCachedNeighborhoods(_cityId: string | number | undefined, _nbs: any[]): void {}
export function invalidateNeighborhoodsCache(_cityId?: string | number): void {}
