import { City, HeroSettings, Neighborhood, PricingCampaign, TripMasterSettings, TripResult, User, YangoSettings, StatisticsData, StoredStatsSnapshot, ShortagesResponse, CampaignShortageRecord } from '../types';
import {
  getCachedCampaignTrips,
  setCachedCampaignTrips,
  invalidateCampaignTripsCache,
  invalidateAllTripsCache,
  getCachedCities,
  setCachedCities,
  invalidateCitiesCache,
  getCachedNeighborhoods,
  setCachedNeighborhoods,
  invalidateNeighborhoodsCache
} from './dbCache';

const BASE_URL = '/api';

async function robustFetch(url: string | URL, options: RequestInit = {}): Promise<Response> {
  const retries = 3;
  const delay = 300;
  for (let i = 0; i < retries; i++) {
    try {
      return await window.fetch(url, options);
    } catch (err: any) {
      if (i === retries - 1) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  return window.fetch(url, options);
}

const fetch = robustFetch;

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (res.ok) return await res.json();
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erreur lors de la connexion.');
  },

  // Users
  async getUsers(): Promise<User[]> {
    try {
      const res = await fetch(`${BASE_URL}/users`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('[API Client] getUsers error:', e);
    }
    return [];
  },

  async createUser(data: { name: string; email: string; role: string; password?: string }): Promise<User> {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la création de l’utilisateur.');
    }
    return res.json();
  },

  async updateUser(id: string | number, data: Partial<User> & { password?: string }): Promise<User> {
    const res = await fetch(`${BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la mise à jour de l’utilisateur.');
    }
    return res.json();
  },

  async changeUserPassword(id: string | number, password: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/users/${id}/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la modification du mot de passe.');
    }
    return res.json();
  },

  async deleteUser(id: string | number): Promise<void> {
    try {
      const idStr = String(id);
      Object.keys(localStorage)
        .filter(k => k.startsWith('citrine_users') || k.includes(idStr))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    const res = await fetch(`${BASE_URL}/users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la suppression de l’utilisateur.');
    }
  },

  // Cities (avec cache 30 jours et réinitialisation immédiate à la modification)
  async getCities(forceRefresh: boolean = false): Promise<(City & { neighborhoodsCount: number; activeNeighborhoodsCount: number; possiblePairs: number })[]> {
    if (!forceRefresh) {
      const cached = getCachedCities();
      if (cached && Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
    }

    try {
      const url = forceRefresh ? `${BASE_URL}/cities?forceRefresh=true` : `${BASE_URL}/cities`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCachedCities(data);
        }
        return data;
      }
    } catch (e) {
      console.warn('[API Client] getCities error:', e);
    }
    return getCachedCities() || [];
  },

  async createCity(data: Partial<City>): Promise<City> {
    invalidateCitiesCache();
    const res = await fetch(`${BASE_URL}/cities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la création de la ville.');
    }
    invalidateCitiesCache();
    return res.json();
  },

  async updateCity(id: string | number, data: Partial<City>): Promise<City> {
    invalidateCitiesCache();
    invalidateNeighborhoodsCache(id);
    const res = await fetch(`${BASE_URL}/cities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erreur lors de la mise à jour de la ville.');
    invalidateCitiesCache();
    invalidateNeighborhoodsCache(id);
    return res.json();
  },

  async deleteCity(id: string | number): Promise<void> {
    invalidateCitiesCache();
    invalidateNeighborhoodsCache(id);
    try {
      const idStr = String(id);
      Object.keys(localStorage)
        .filter(k => k.startsWith('citrine_cities') || k.startsWith('citrine_nbs') || k.includes(idStr))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    const res = await fetch(`${BASE_URL}/cities/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression de la ville.');
    invalidateCitiesCache();
    invalidateNeighborhoodsCache(id);
  },

  // Neighborhoods (avec cache 30 jours par ville et réinitialisation immédiate à la modification)
  async getNeighborhoods(cityId?: string | number, forceRefresh: boolean = false): Promise<Neighborhood[]> {
    if (!forceRefresh) {
      const cached = getCachedNeighborhoods(cityId);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
    }

    try {
      const params = new URLSearchParams();
      if (cityId !== undefined && cityId !== null) params.append('cityId', String(cityId));
      if (forceRefresh) params.append('forceRefresh', 'true');
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${BASE_URL}/neighborhoods${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCachedNeighborhoods(cityId, data);
        }
        return data;
      }
    } catch (e) {
      console.warn('[API Client] getNeighborhoods error:', e);
    }
    return getCachedNeighborhoods(cityId) || [];
  },

  async createNeighborhood(data: Partial<Neighborhood>): Promise<Neighborhood> {
    invalidateNeighborhoodsCache(data.cityId);
    const res = await fetch(`${BASE_URL}/neighborhoods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de l’ajout du quartier.');
    }
    invalidateNeighborhoodsCache(data.cityId);
    return res.json();
  },

  async updateNeighborhood(id: string | number, data: Partial<Neighborhood>): Promise<Neighborhood> {
    invalidateNeighborhoodsCache(data.cityId);
    const res = await fetch(`${BASE_URL}/neighborhoods/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erreur lors de la mise à jour du quartier.');
    invalidateNeighborhoodsCache(data.cityId);
    return res.json();
  },

  async deleteNeighborhood(id: string | number, cityId?: string | number): Promise<void> {
    invalidateNeighborhoodsCache(cityId);
    try {
      const idStr = String(id);
      Object.keys(localStorage).filter(k => k.startsWith('citrine_nbs_cache') || k.includes(idStr)).forEach(k => localStorage.removeItem(k));
    } catch {}
    const res = await fetch(`${BASE_URL}/neighborhoods/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression du quartier.');
    invalidateNeighborhoodsCache(cityId);
  },

  async clearCityNeighborhoods(cityId: string | number): Promise<{ success: boolean; deletedCount: number }> {
    invalidateNeighborhoodsCache(cityId);
    try {
      const idStr = String(cityId);
      Object.keys(localStorage).filter(k => k.startsWith('citrine_nbs_cache') || k.includes(idStr)).forEach(k => localStorage.removeItem(k));
    } catch {}
    const res = await fetch(`${BASE_URL}/neighborhoods/city/${encodeURIComponent(String(cityId))}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression des quartiers de la ville.');
    invalidateNeighborhoodsCache(cityId);
    return res.json();
  },

  async batchToggleNeighborhoods(cityId: string | number, active: boolean): Promise<{ success: boolean; updatedCount: number; active: boolean }> {
    invalidateNeighborhoodsCache(cityId);
    const res = await fetch(`${BASE_URL}/neighborhoods/batch-toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId: String(cityId), active })
    });
    if (!res.ok) throw new Error('Erreur lors de la mise à jour globale des quartiers.');
    invalidateNeighborhoodsCache(cityId);
    return res.json();
  },

  async seedCityNeighborhoods(cityId: string | number): Promise<{ neighborhoods: Neighborhood[] }> {
    invalidateNeighborhoodsCache(cityId);
    const res = await fetch(`${BASE_URL}/neighborhoods/seed-city`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId: String(cityId) })
    });
    if (!res.ok) throw new Error('Erreur de réinitialisation des quartiers.');
    invalidateNeighborhoodsCache(cityId);
    return res.json();
  },

  async importNeighborhoodsBatch(
    cityId: string | number,
    neighborhoods: Array<{ name: string; lat: number; lng: number; zoneType?: string; active?: boolean }>
  ): Promise<{ success: boolean; count: number; neighborhoods: Neighborhood[] }> {
    const res = await fetch(`${BASE_URL}/neighborhoods/import-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId: String(cityId), neighborhoods })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de l’import des quartiers.');
    }
    return res.json();
  },

  async reconcileNeighborhoodsBatch(
    cityId: string | number,
    items: any[]
  ): Promise<{ success: boolean; updatedCount: number; createdCount: number; ignoredCount: number; message: string }> {
    const res = await fetch(`${BASE_URL}/neighborhoods/reconcile-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId: String(cityId), items })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la rectification des quartiers.');
    }
    // Invalider le cache local pour recharger les nouveaux quartiers
    Object.keys(localStorage)
      .filter(k => k.startsWith('citrine_nbs_cache'))
      .forEach(k => localStorage.removeItem(k));
    return res.json();
  },

  // Campaigns
  async getCampaigns(cityId?: string | number): Promise<PricingCampaign[]> {
    const cityIdStr = cityId ? String(cityId) : 'all';
    const CACHE_KEY = `citrine_campaigns_v7_${cityIdStr}`;

    try {
      const url = cityId ? `${BASE_URL}/campaigns?cityId=${encodeURIComponent(String(cityId))}` : `${BASE_URL}/campaigns`;
      const res = await fetch(url);
      if (res.ok) {
        const freshList: PricingCampaign[] = await res.json();
        // Le serveur fait foi : mise à jour immédiate du cache local (y compris si la liste est vide)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: freshList, timestamp: Date.now() }));
        } catch {}
        return freshList;
      }
    } catch (e) {
      console.warn('[API Client] getCampaigns network error:', e);
      // En cas d'erreur réseau complète (hors-ligne), lecture de secours du cache local
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const { data } = JSON.parse(raw);
          if (Array.isArray(data)) return data;
        }
      } catch {}
    }

    return [];
  },

  async getCampaign(id: string | number): Promise<PricingCampaign | null> {
    try {
      const res = await fetch(`${BASE_URL}/campaigns/${id}`);
      if (res.status === 404) return null;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Campagne introuvable.');
      }
      return await res.json();
    } catch {
      return null;
    }
  },

  async syncCampaignsCache(campaigns: PricingCampaign[]): Promise<void> {
    try {
      await fetch(`${BASE_URL}/campaigns/sync-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaigns })
      });
    } catch {}
  },

  async startCampaign(data: {
    cityId: string | number;
    triggeredByUserId?: string | number;
    triggeredByUserName?: string;
    triggeredByUserRole?: string;
    triggerType?: 'manual' | 'scheduled';
    selectedClasses?: string[];
    sampleLimit?: number | 'all';
    scopeMode?: 'global' | 'intra' | 'inter' | 'airport' | 'city';
    arrondissement?: string;
    originArrondissement?: string;
    destArrondissement?: string;
    comment?: string;
    timeSlotOverride?: string;
  }): Promise<{ message: string; campaign: PricingCampaign; totalChunks: number; totalPairs: number }> {
    const res = await fetch(`${BASE_URL}/campaigns/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors du lancement de la campagne.');
    }
    const result = await res.json();

    // Ajout incrémental de la nouvelle campagne au cache local sans rien effacer
    if (result.campaign) {
      const cacheKeys = [`citrine_campaigns_v7_all`, `citrine_campaigns_v7_${data.cityId}`];
      for (const key of cacheKeys) {
        try {
          const raw = localStorage.getItem(key);
          let list: PricingCampaign[] = [];
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.data)) list = parsed.data;
          }
          if (!list.some(c => c.id === result.campaign.id)) {
            list.unshift(result.campaign);
            localStorage.setItem(key, JSON.stringify({ data: list, timestamp: Date.now() }));
          }
        } catch {}
      }
    }

    return result;
  },

  async processCampaignChunk(
    campaignId: string | number, 
    chunkIndex: number, 
    signal?: AbortSignal,
    meta?: {
      cityId?: string | number;
      cityName?: string;
      currency?: string;
      scopeMode?: string;
      arrondissement?: string;
      originArrondissement?: string;
      destArrondissement?: string;
      sampleLimit?: number | 'all';
    }
  ): Promise<{
    success: boolean;
    chunkIndex: number;
    completedPairs: number;
    campaign: PricingCampaign;
    chunkTrips: TripResult[];
    chunkCanonicalTrips?: any[];
  }> {
    const res = await fetch(`${BASE_URL}/campaigns/${campaignId}/process-chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunkIndex, ...meta, fallbackMeta: meta }),
      signal
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur lors du traitement du lot ${chunkIndex}.`);
    }
    return res.json();
  },

  async finalizeCampaign(
    campaignId: string | number, 
    canonicalTrips?: any[], 
    trips?: TripResult[]
  ): Promise<{ success: boolean; campaign: PricingCampaign }> {
    const res = await fetch(`${BASE_URL}/campaigns/${campaignId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canonicalTrips, trips })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la finalisation de la campagne.');
    }
    const data = await res.json();
    if (Array.isArray(trips) && trips.length > 0) {
      setCachedCampaignTrips(String(campaignId), trips).catch(() => {});
    }
    return data;
  },

  async cancelCampaign(id: string | number): Promise<{ campaign: PricingCampaign }> {
    const res = await fetch(`${BASE_URL}/campaigns/${id}/cancel`, { method: 'POST' });
    if (!res.ok) throw new Error('Erreur lors de l’interruption de la campagne.');
    return res.json();
  },

  async updateCampaignComment(id: string | number, comment: string, timeSlotOverride?: string): Promise<PricingCampaign> {
    const res = await fetch(`${BASE_URL}/campaigns/${id}/comment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment, timeSlotOverride })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la mise à jour du commentaire.');
    }
    const data = await res.json();
    try {
      const idStr = String(id);
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('citrine_campaigns_')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.data)) {
              parsed.data = parsed.data.map((c: any) =>
                String(c.id) === idStr
                  ? {
                      ...c,
                      comment,
                      comments: comment,
                      timeSlotOverride: timeSlotOverride === 'auto' ? undefined : (timeSlotOverride ?? c.timeSlotOverride)
                    }
                  : c
              );
              localStorage.setItem(key, JSON.stringify(parsed));
            }
          }
        }
      }
    } catch {}
    return data.campaign;
  },

  async stepCampaign(id: string | number): Promise<{ success: boolean; campaign?: PricingCampaign }> {
    try {
      const res = await fetch(`${BASE_URL}/campaigns/${id}/step`, { method: 'POST' });
      if (res.ok) return await res.json();
    } catch {}
    return { success: false };
  },

  async deleteCampaign(id: string | number): Promise<void> {
    const idStr = String(id);
    await invalidateCampaignTripsCache(idStr);
    try {
      localStorage.removeItem(`citrine_campaigns_${idStr}`);
      localStorage.removeItem(`citrine_trips_${idStr}`);
      localStorage.removeItem(`citrine_canonical_${idStr}`);
      localStorage.removeItem(`trips_${idStr}`);

      const allKeys = Object.keys(localStorage);
      for (const key of allKeys) {
        if (key.startsWith('citrine_campaigns_') || key.startsWith('citrine_trips_')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed.data)) {
                parsed.data = parsed.data.filter((c: any) => String(c.id) !== idStr);
                localStorage.setItem(key, JSON.stringify(parsed));
              } else if (Array.isArray(parsed)) {
                const filtered = parsed.filter((c: any) => String(c.id) !== idStr);
                localStorage.setItem(key, JSON.stringify(filtered));
              }
            } catch {}
          }
        }
      }
    } catch {}

    const res = await fetch(`${BASE_URL}/campaigns/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression de la campagne.');
  },

  async deleteAllCampaigns(): Promise<void> {
    try {
      const allKeys = Object.keys(localStorage);
      for (const key of allKeys) {
        if (
          key.startsWith('citrine_campaigns') ||
          key.startsWith('citrine_trips') ||
          key.startsWith('trips_') ||
          key.startsWith('citrine_canonical')
        ) {
          localStorage.removeItem(key);
        }
      }
    } catch {}
    await invalidateAllTripsCache();
    const res = await fetch(`${BASE_URL}/campaigns`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression de toutes les campagnes.');
  },

  // Trip Results avec Cache Local PWA IndexedDB (0 lecture Firestore)
  async getCampaignResults(
    campaignId: string | number,
    filters?: {
      startNeighborhood?: string;
      endNeighborhood?: string;
      minPrice?: number;
      maxPrice?: number;
      search?: string;
      limit?: number;
      all?: boolean;
    }
  ): Promise<TripResult[]> {
    const campIdStr = String(campaignId);
    // Si aucun filtre spécifique, tenter d'abord de servir depuis le cache local IndexedDB
    const hasCustomFilters = Boolean(
      filters?.startNeighborhood ||
      filters?.endNeighborhood ||
      filters?.minPrice ||
      filters?.maxPrice ||
      filters?.search ||
      filters?.limit
    );

    if (!hasCustomFilters) {
      const cached = await getCachedCampaignTrips(campIdStr);
      if (cached && cached.length > 0) {
        // En arrière-plan non-bloquant, synchroniser le serveur si nécessaire
        fetch(`${BASE_URL}/campaigns/${campIdStr}/sync-trips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trips: cached })
        }).catch(() => {});
        return cached as TripResult[];
      }
    }

    try {
      const params = new URLSearchParams();
      params.append('all', 'true');
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.startNeighborhood) params.append('startNeighborhood', filters.startNeighborhood);
      if (filters?.endNeighborhood) params.append('endNeighborhood', filters.endNeighborhood);
      if (filters?.minPrice) params.append('minPrice', filters.minPrice.toString());
      if (filters?.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
      if (filters?.search) params.append('search', filters.search);

      const qs = params.toString();
      const res = await fetch(`${BASE_URL}/campaigns/${campIdStr}/results${qs ? `?${qs}` : ''}`);
      if (res.status === 404) return [];
      if (!res.ok) throw new Error('Erreur lors de la récupération des trajets.');
      const data = await res.json();

      // Sauvegarde dans IndexedDB si données reçues et sans filtres restrictifs
      if (!hasCustomFilters && Array.isArray(data) && data.length > 0) {
        setCachedCampaignTrips(campIdStr, data).catch(() => {});
      }

      return data;
    } catch {
      return [];
    }
  },

  getExportCsvUrl(campaignId: string | number): string {
    return `${BASE_URL}/campaigns/${campaignId}/export`;
  },

  // Single Route Test
  async testSingleRoute(data: {
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    startName?: string;
    endName?: string;
    tariffClass?: string;
    cityCurrency?: string;
  }) {
    const res = await fetch(`${BASE_URL}/routestats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de l’estimation Yango.');
    }
    return res.json();
  },

  // Settings
  async getSettings(): Promise<YangoSettings> {
    const res = await fetch(`${BASE_URL}/settings`);
    if (!res.ok) throw new Error('Impossible de charger les paramètres.');
    return res.json();
  },

  async updateSettings(data: Partial<YangoSettings>): Promise<{ success: boolean; settings: YangoSettings }> {
    const res = await fetch(`${BASE_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erreur lors de la mise à jour des paramètres.');
    return res.json();
  },

  async getLastYangoRawJson(): Promise<{ timestamp: string; rawJson: any; rawText: string }> {
    const res = await fetch(`${BASE_URL}/yango/last-raw-json`);
    if (!res.ok) return { timestamp: '', rawJson: null, rawText: '' };
    return res.json();
  },

  // Hero Settings
  async getHeroSettings(): Promise<HeroSettings> {
    const res = await fetch(`${BASE_URL}/settings/hero`);
    if (!res.ok) throw new Error('Impossible de charger les paramètres Hero.');
    return res.json();
  },

  async updateHeroSettings(data: Partial<HeroSettings>): Promise<{ success: boolean; settings: HeroSettings }> {
    const res = await fetch(`${BASE_URL}/settings/hero`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erreur lors de la mise à jour des paramètres Hero.');
    return res.json();
  },

  // Trip Master Settings
  async getTripMasterSettings(): Promise<TripMasterSettings> {
    const res = await fetch(`${BASE_URL}/settings/tripmaster`);
    if (!res.ok) throw new Error('Impossible de charger les paramètres Trip Master.');
    return res.json();
  },

  async updateTripMasterSettings(data: Partial<TripMasterSettings>): Promise<{ success: boolean; settings: TripMasterSettings }> {
    const res = await fetch(`${BASE_URL}/settings/tripmaster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erreur lors de la mise à jour des paramètres Trip Master.');
    return res.json();
  },

  // History & Audit logs (avec cache navigateur 7 jours)
  async getHistory(): Promise<any[]> {
    const CACHE_KEY = 'citrine_history_v7';
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    let cachedList: any[] = [];
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { data, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp < SEVEN_DAYS_MS && Array.isArray(data)) {
          cachedList = data;
        }
      }
    } catch {}

    try {
      const res = await fetch(`${BASE_URL}/history`);
      if (res.ok) {
        const freshList: any[] = await res.json();
        const map = new Map<string, any>();
        for (const item of cachedList) {
          if (item && item.id) map.set(item.id, item);
        }
        for (const item of freshList) {
          if (item && item.id) map.set(item.id, item);
        }
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: merged, timestamp: Date.now() }));
        } catch {}
        return merged;
      }
    } catch (e) {
      console.warn('[API Client] getHistory error:', e);
    }

    return cachedList;
  },

  async deleteHistoryItem(id: string | number): Promise<void> {
    try { localStorage.removeItem('citrine_history_v7'); } catch {}
    await fetch(`${BASE_URL}/history/${id}`, { method: 'DELETE' });
  },

  async clearAllHistory(): Promise<void> {
    try { localStorage.removeItem('citrine_history_v7'); } catch {}
    const res = await fetch(`${BASE_URL}/history`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression de tout l’historique.');
  },

  // Export Database
  getDbStructureExportUrl(): string {
    return `${BASE_URL}/export/db-structure`;
  },

  getDbFullDataExportUrl(): string {
    return `${BASE_URL}/export/db-full`;
  },

  // Statistics & Snapshots
  async getStatistics(cityId?: string | number): Promise<StatisticsData> {
    const qs = cityId ? `?cityId=${encodeURIComponent(String(cityId))}` : '';
    const res = await fetch(`${BASE_URL}/statistics${qs}`);
    if (!res.ok) throw new Error('Impossible de charger les statistiques.');
    return res.json();
  },

  async saveStatisticsSnapshot(data: {
    title?: string;
    cityName?: string;
    notes?: string;
    customData?: any;
  }): Promise<{ success: boolean; snapshot: StoredStatsSnapshot }> {
    const res = await fetch(`${BASE_URL}/statistics/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la sauvegarde de l’instantané.');
    }
    return res.json();
  },

  async deleteStatisticsSnapshot(id: string | number): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/statistics/snapshots/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression de l’instantané.');
    return res.json();
  },

  // Shortages (Pénuries & Ruptures)
  async getShortages(params?: {
    cityId?: string | number;
    timeSlot?: string;
    arrondissement?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ShortagesResponse> {
    const sp = new URLSearchParams();
    if (params?.cityId && params.cityId !== 'all') sp.append('cityId', String(params.cityId));
    if (params?.timeSlot && params.timeSlot !== 'all') sp.append('timeSlot', params.timeSlot);
    if (params?.arrondissement && params.arrondissement !== 'all') sp.append('arrondissement', params.arrondissement);
    if (params?.search) sp.append('search', params.search);
    if (params?.limit) sp.append('limit', String(params.limit));
    if (params?.offset) sp.append('offset', String(params.offset));

    const qs = sp.toString() ? `?${sp.toString()}` : '';
    const res = await fetch(`${BASE_URL}/shortages${qs}`);
    if (!res.ok) throw new Error('Impossible de charger les trajets en pénurie.');
    return res.json();
  },

  getShortagesExportUrl(cityId?: string | number, timeSlot?: string): string {
    const sp = new URLSearchParams();
    if (cityId && cityId !== 'all') sp.append('cityId', String(cityId));
    if (timeSlot && timeSlot !== 'all') sp.append('timeSlot', timeSlot);
    const qs = sp.toString() ? `?${sp.toString()}` : '';
    return `${BASE_URL}/shortages/export${qs}`;
  },

  async deleteShortage(id: string | number): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/shortages/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression du trajet en pénurie.');
    return res.json();
  },

  async reExtractShortages(): Promise<{ success: boolean; extractedCount: number; total: number }> {
    const res = await fetch(`${BASE_URL}/shortages/re-extract`, { method: 'POST' });
    if (!res.ok) throw new Error('Erreur lors de la ré-extraction des pénuries.');
    return res.json();
  }
};
