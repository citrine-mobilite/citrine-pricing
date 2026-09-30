import { City, HeroSettings, Neighborhood, PricingCampaign, TripMasterSettings, TripResult, User, YangoSettings } from '../types';
import { getCachedCampaignTrips, setCachedCampaignTrips, invalidateCampaignTripsCache } from './dbCache';

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

  async createUser(data: { name: string; email: string; role: string }): Promise<User> {
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

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const res = await fetch(`${BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erreur lors de la mise à jour de l’utilisateur.');
    return res.json();
  },

  async deleteUser(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la suppression de l’utilisateur.');
    }
  },

  // Cities (avec cache navigateur 24h et 0 lecture Firestore)
  async getCities(forceRefresh: boolean = false): Promise<(City & { neighborhoodsCount: number; activeNeighborhoodsCount: number; possiblePairs: number })[]> {
    const CACHE_KEY = 'citrine_cities_cache_v2';
    const TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < TTL_MS && Array.isArray(data) && data.length > 0) {
            return data;
          }
        }
      } catch {}
    }

    try {
      const url = forceRefresh ? `${BASE_URL}/cities?forceRefresh=true` : `${BASE_URL}/cities`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        } catch {}
        return data;
      }
    } catch (e) {
      console.warn('[API Client] getCities error:', e);
    }
    return [];
  },

  async createCity(data: Partial<City>): Promise<City> {
    try { localStorage.removeItem('citrine_cities_cache_v2'); } catch {}
    const res = await fetch(`${BASE_URL}/cities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la création de la ville.');
    }
    return res.json();
  },

  async updateCity(id: string, data: Partial<City>): Promise<City> {
    try { localStorage.removeItem('citrine_cities_cache_v2'); } catch {}
    const res = await fetch(`${BASE_URL}/cities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erreur lors de la mise à jour de la ville.');
    return res.json();
  },

  async deleteCity(id: string): Promise<void> {
    try { localStorage.removeItem('citrine_cities_cache_v2'); } catch {}
    const res = await fetch(`${BASE_URL}/cities/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression de la ville.');
  },

  // Neighborhoods (avec cache navigateur 24h et 0 lecture Firestore)
  async getNeighborhoods(cityId?: string, forceRefresh: boolean = false): Promise<Neighborhood[]> {
    const CACHE_KEY = `citrine_nbs_cache_v2_${cityId || 'all'}`;
    const TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < TTL_MS && Array.isArray(data) && data.length > 0) {
            return data;
          }
        }
      } catch {}
    }

    try {
      const params = new URLSearchParams();
      if (cityId) params.append('cityId', cityId);
      if (forceRefresh) params.append('forceRefresh', 'true');
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${BASE_URL}/neighborhoods${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        } catch {}
        return data;
      }
    } catch (e) {
      console.warn('[API Client] getNeighborhoods error:', e);
    }
    return [];
  },

  async createNeighborhood(data: Partial<Neighborhood>): Promise<Neighborhood> {
    try {
      Object.keys(localStorage).filter(k => k.startsWith('citrine_nbs_cache_v2')).forEach(k => localStorage.removeItem(k));
    } catch {}
    const res = await fetch(`${BASE_URL}/neighborhoods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de l’ajout du quartier.');
    }
    return res.json();
  },

  async updateNeighborhood(id: string, data: Partial<Neighborhood>): Promise<Neighborhood> {
    try {
      Object.keys(localStorage).filter(k => k.startsWith('citrine_nbs_cache_v2')).forEach(k => localStorage.removeItem(k));
    } catch {}
    const res = await fetch(`${BASE_URL}/neighborhoods/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erreur lors de la mise à jour du quartier.');
    return res.json();
  },

  async deleteNeighborhood(id: string): Promise<void> {
    try {
      Object.keys(localStorage).filter(k => k.startsWith('citrine_nbs_cache_v2')).forEach(k => localStorage.removeItem(k));
    } catch {}
    const res = await fetch(`${BASE_URL}/neighborhoods/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression du quartier.');
  },

  async clearCityNeighborhoods(cityId: string): Promise<{ success: boolean; deletedCount: number }> {
    const res = await fetch(`${BASE_URL}/neighborhoods/city/${encodeURIComponent(cityId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression des quartiers de la ville.');
    return res.json();
  },

  async batchToggleNeighborhoods(cityId: string, active: boolean): Promise<{ success: boolean; updatedCount: number; active: boolean }> {
    const res = await fetch(`${BASE_URL}/neighborhoods/batch-toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId, active })
    });
    if (!res.ok) throw new Error('Erreur lors de la mise à jour globale des quartiers.');
    return res.json();
  },

  async seedCityNeighborhoods(cityId: string): Promise<{ neighborhoods: Neighborhood[] }> {
    const res = await fetch(`${BASE_URL}/neighborhoods/seed-city`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId })
    });
    if (!res.ok) throw new Error('Erreur de réinitialisation des quartiers.');
    return res.json();
  },

  async importNeighborhoodsBatch(
    cityId: string,
    neighborhoods: Array<{ name: string; lat: number; lng: number; zoneType?: string; active?: boolean }>
  ): Promise<{ success: boolean; count: number; neighborhoods: Neighborhood[] }> {
    const res = await fetch(`${BASE_URL}/neighborhoods/import-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId, neighborhoods })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de l’import des quartiers.');
    }
    return res.json();
  },

  // Campaigns (avec cache local 7 jours - conserve les anciennes et fusionne les nouvelles)
  async getCampaigns(cityId?: string): Promise<PricingCampaign[]> {
    const CACHE_KEY = `citrine_campaigns_v7_${cityId || 'all'}`;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    let cachedList: PricingCampaign[] = [];
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
      const url = cityId ? `${BASE_URL}/campaigns?cityId=${encodeURIComponent(cityId)}` : `${BASE_URL}/campaigns`;
      const res = await fetch(url);
      if (res.ok) {
        const freshList: PricingCampaign[] = await res.json();
        const map = new Map<string, PricingCampaign>();

        // Intégration prioritaire des campagnes en cache (1 semaine)
        for (const c of cachedList) {
          map.set(c.id, c);
        }
        // Mise à jour avec les campagnes fraîches renvoyées par le serveur
        for (const c of freshList) {
          map.set(c.id, c);
        }

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );

        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: merged, timestamp: Date.now() }));
        } catch {}

        return merged;
      }
    } catch (e) {
      console.warn('[API Client] getCampaigns network error:', e);
    }

    return cachedList;
  },

  async getCampaign(id: string): Promise<PricingCampaign | null> {
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

  async startCampaign(data: {
    cityId: string;
    triggeredByUserId?: string;
    triggeredByUserName?: string;
    triggerType?: 'manual' | 'scheduled';
    selectedClasses?: string[];
    sampleLimit?: number | 'all';
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
    return res.json();
  },

  async processCampaignChunk(campaignId: string, chunkIndex: number): Promise<{
    success: boolean;
    chunkIndex: number;
    completedPairs: number;
    campaign: PricingCampaign;
    chunkTrips: TripResult[];
  }> {
    const res = await fetch(`${BASE_URL}/campaigns/${campaignId}/process-chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunkIndex })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur lors du traitement du lot ${chunkIndex}.`);
    }
    return res.json();
  },

  async finalizeCampaign(campaignId: string): Promise<{ success: boolean; campaign: PricingCampaign }> {
    const res = await fetch(`${BASE_URL}/campaigns/${campaignId}/finalize`, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la finalisation de la campagne.');
    }
    return res.json();
  },

  async cancelCampaign(id: string): Promise<{ campaign: PricingCampaign }> {
    const res = await fetch(`${BASE_URL}/campaigns/${id}/cancel`, { method: 'POST' });
    if (!res.ok) throw new Error('Erreur lors de l’interruption de la campagne.');
    return res.json();
  },

  async stepCampaign(id: string): Promise<{ success: boolean; campaign?: PricingCampaign }> {
    try {
      const res = await fetch(`${BASE_URL}/campaigns/${id}/step`, { method: 'POST' });
      if (res.ok) return await res.json();
    } catch {}
    return { success: false };
  },

  async deleteCampaign(id: string): Promise<void> {
    await invalidateCampaignTripsCache(id);
    const res = await fetch(`${BASE_URL}/campaigns/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression de la campagne.');
  },

  async deleteAllCampaigns(): Promise<void> {
    const res = await fetch(`${BASE_URL}/campaigns`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression de toutes les campagnes.');
  },

  // Trip Results avec Cache Local PWA IndexedDB (0 lecture Firestore)
  async getCampaignResults(
    campaignId: string,
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
      const cached = await getCachedCampaignTrips(campaignId);
      if (cached && cached.length > 0) {
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
      const res = await fetch(`${BASE_URL}/campaigns/${campaignId}/results${qs ? `?${qs}` : ''}`);
      if (res.status === 404) return [];
      if (!res.ok) throw new Error('Erreur lors de la récupération des trajets.');
      const data = await res.json();

      // Sauvegarde dans IndexedDB si données reçues et sans filtres restrictifs
      if (!hasCustomFilters && Array.isArray(data) && data.length > 0) {
        setCachedCampaignTrips(campaignId, data).catch(() => {});
      }

      return data;
    } catch {
      return [];
    }
  },

  getExportCsvUrl(campaignId: string): string {
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

  // History & Audit logs
  async getHistory(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/history`);
    if (!res.ok) return [];
    return res.json();
  },

  async deleteHistoryItem(id: string): Promise<void> {
    await fetch(`${BASE_URL}/history/${id}`, { method: 'DELETE' });
  },

  async clearAllHistory(): Promise<void> {
    const res = await fetch(`${BASE_URL}/history`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression de tout l’historique.');
  }
};
