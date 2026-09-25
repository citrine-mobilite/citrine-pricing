import { City, HeroSettings, Neighborhood, PricingCampaign, TripResult, User, YangoSettings } from '../types';

const BASE_URL = '/api';

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la connexion.');
    }
    return res.json();
  },

  // Users
  async getUsers(): Promise<User[]> {
    const res = await fetch(`${BASE_URL}/users`);
    if (!res.ok) throw new Error('Impossible de charger les utilisateurs.');
    return res.json();
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

  // Cities
  async getCities(): Promise<(City & { neighborhoodsCount: number; activeNeighborhoodsCount: number; possiblePairs: number })[]> {
    const res = await fetch(`${BASE_URL}/cities`);
    if (!res.ok) throw new Error('Impossible de récupérer les villes.');
    return res.json();
  },

  async createCity(data: Partial<City>): Promise<City> {
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
    const res = await fetch(`${BASE_URL}/cities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erreur lors de la mise à jour de la ville.');
    return res.json();
  },

  async deleteCity(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/cities/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression de la ville.');
  },

  // Neighborhoods
  async getNeighborhoods(cityId?: string): Promise<Neighborhood[]> {
    const url = cityId ? `${BASE_URL}/neighborhoods?cityId=${encodeURIComponent(cityId)}` : `${BASE_URL}/neighborhoods`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Impossible de récupérer les quartiers.');
    return res.json();
  },

  async createNeighborhood(data: Partial<Neighborhood>): Promise<Neighborhood> {
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
    const res = await fetch(`${BASE_URL}/neighborhoods/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erreur lors de la mise à jour du quartier.');
    return res.json();
  },

  async deleteNeighborhood(id: string): Promise<void> {
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

  // Campaigns
  async getCampaigns(cityId?: string): Promise<PricingCampaign[]> {
    const url = cityId ? `${BASE_URL}/campaigns?cityId=${encodeURIComponent(cityId)}` : `${BASE_URL}/campaigns`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Impossible de récupérer les campagnes.');
    return res.json();
  },

  async getCampaign(id: string): Promise<PricingCampaign | null> {
    try {
      const res = await fetch(`${BASE_URL}/campaigns/${id}`);
      if (res.status === 404) return null;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Campagne introuvable.');
      }
      return res.json();
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
  }): Promise<{ message: string; campaign: PricingCampaign }> {
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

  async cancelCampaign(id: string): Promise<{ campaign: PricingCampaign }> {
    const res = await fetch(`${BASE_URL}/campaigns/${id}/cancel`, { method: 'POST' });
    if (!res.ok) throw new Error('Erreur lors de l’interruption de la campagne.');
    return res.json();
  },

  async deleteCampaign(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/campaigns/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression de la campagne.');
  },

  // Trip Results
  async getCampaignResults(
    campaignId: string,
    filters?: {
      startNeighborhood?: string;
      endNeighborhood?: string;
      minPrice?: number;
      maxPrice?: number;
      search?: string;
    }
  ): Promise<TripResult[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.startNeighborhood) params.append('startNeighborhood', filters.startNeighborhood);
      if (filters?.endNeighborhood) params.append('endNeighborhood', filters.endNeighborhood);
      if (filters?.minPrice) params.append('minPrice', filters.minPrice.toString());
      if (filters?.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
      if (filters?.search) params.append('search', filters.search);

      const qs = params.toString();
      const res = await fetch(`${BASE_URL}/campaigns/${campaignId}/results${qs ? `?${qs}` : ''}`);
      if (res.status === 404) return [];
      if (!res.ok) throw new Error('Erreur lors de la récupération des trajets.');
      return res.json();
    } catch {
      return [];
    }
  },

  getExportCsvUrl(campaignId: string): string {
    return `${BASE_URL}/campaigns/${campaignId}/export`;
  },

  // Trigger 3x/day schedule
  async triggerScheduledPricing(): Promise<{ success: boolean; triggeredCount: number; cities: string[] }> {
    const res = await fetch(`${BASE_URL}/cron/trigger-scheduled`, { method: 'POST' });
    if (!res.ok) throw new Error('Erreur lors du déclenchement automatique.');
    return res.json();
  },

  // Single Route Test
  async testSingleRoute(data: {
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
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
  }
};
