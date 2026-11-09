import { User, City, Neighborhood, PricingCampaign, TripResult } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export async function testConnection(): Promise<boolean> {
  return true;
}

export async function loginWithGoogle(): Promise<User> {
  throw new Error('Connexion directe par email/mot de passe MySQL');
}

export async function logoutFirebase(): Promise<void> {}

export async function getFirestoreCities(): Promise<City[]> {
  const res = await fetch('/api/cities');
  return res.json();
}

export async function saveFirestoreCity(city: City): Promise<void> {
  await fetch(`/api/cities/${city.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(city)
  });
}

export async function getFirestoreNeighborhoods(_cityId: string): Promise<Neighborhood[]> {
  const res = await fetch('/api/neighborhoods');
  return res.json();
}

export async function saveFirestoreNeighborhood(cityId: string, nb: Neighborhood): Promise<void> {
  await fetch(`/api/neighborhoods/${nb.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...nb, cityId })
  });
}

export async function getFirestoreCampaigns(): Promise<PricingCampaign[]> {
  const res = await fetch('/api/campaigns');
  return res.json();
}

export async function saveFirestoreCampaign(_campaign: PricingCampaign): Promise<void> {}
export async function saveFirestoreTripResult(_campaignId: string, _trip: TripResult): Promise<void> {}

export async function getFirestoreStats(): Promise<{ userCount: number; cityCount: number; neighborhoodCount: number }> {
  try {
    const [cRes, nRes] = await Promise.all([
      fetch('/api/cities'),
      fetch('/api/neighborhoods')
    ]);
    const cities = await cRes.json();
    const nbs = await nRes.json();
    return {
      userCount: 1,
      cityCount: Array.isArray(cities) ? cities.length : 0,
      neighborhoodCount: Array.isArray(nbs) ? nbs.length : 0
    };
  } catch {
    return { userCount: 1, cityCount: 1, neighborhoodCount: 10 };
  }
}

export async function seedFirestoreDatabase(): Promise<{ success: boolean; usersCount: number; citiesCount: number; neighborhoodsCount: number }> {
  const stats = await getFirestoreStats();
  return {
    success: true,
    usersCount: stats.userCount,
    citiesCount: stats.cityCount,
    neighborhoodsCount: stats.neighborhoodCount
  };
}
