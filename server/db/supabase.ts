import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { City, Neighborhood, User, PricingCampaign, CanonicalTrip } from '../types.js';
import {
  cities,
  neighborhoods,
  setNeighborhoods,
  users,
  memoryCampaigns,
  saveCitiesDiskBackup,
  saveNeighborhoodsDiskBackup,
  saveUsersDiskBackup,
  saveLocalCampaignsDiskBackup
} from './memoryStore.js';

dotenv.config();

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const CONFIG_FILE = path.resolve(DATA_DIR, 'supabase_config.json');
const TRIPS_DIR = path.resolve(DATA_DIR, 'trips');

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  connected?: boolean;
}

let cachedConfig: SupabaseConfig = {
  url: process.env.SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
};

// Charger la config sauvegardée sur disque si présente
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.url && parsed.anonKey) {
      cachedConfig = { ...cachedConfig, ...parsed };
    }
  }
} catch (e: any) {
  console.warn('[Supabase] Warning reading config file:', e.message);
}

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  const url = cachedConfig.url;
  const key = cachedConfig.serviceRoleKey || cachedConfig.anonKey;
  if (!url || !key) return null;

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    return supabaseClient;
  } catch (err: any) {
    console.warn('[Supabase] Client init failed:', err.message);
    return null;
  }
}

export function saveSupabaseConfig(config: Partial<SupabaseConfig>): SupabaseConfig {
  cachedConfig = {
    ...cachedConfig,
    ...config
  };
  supabaseClient = null; // Re-create on next get

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cachedConfig, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[Supabase] Warning writing config file:', e.message);
  }

  return cachedConfig;
}

export function getSupabaseConfig(): SupabaseConfig {
  return { ...cachedConfig };
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'URL ou Clé API Supabase non configurée.' };
  }

  try {
    const { data, error } = await client.from('cities').select('id, name').limit(5);
    if (error) {
      if (error.code === '42P01') {
        return {
          success: true,
          message: 'Connexion à Supabase établie ! (Note: La table "cities" n’a pas encore été créée, veuillez appliquer le script SQL fourni).'
        };
      }
      return { success: false, message: `Erreur Supabase: ${error.message} (${error.code})` };
    }
    return {
      success: true,
      message: `Connexion Supabase réussie avec succès ! (${data?.length || 0} ville(s) trouvée(s) en base)`
    };
  } catch (err: any) {
    return { success: false, message: `Connexion impossible: ${err.message}` };
  }
}

/**
 * Exécute un upsert résilient dans Supabase :
 * Si une colonne spécifique n'existe pas en base (code 42703), retombe automatiquement
 * sur un upsert simplifié basé sur les clés primaires et la colonne JSONB `data`.
 */
async function resilientUpsert(
  table: string,
  fullRecord: Record<string, any>,
  fallbackRecord?: Record<string, any>
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from(table).upsert(fullRecord, { onConflict: 'id' });
    if (!error) return true;

    // Colonne manquante dans le schéma PostgreSQL existant
    if (error.code === '42703' && fallbackRecord) {
      const { error: fallbackErr } = await client.from(table).upsert(fallbackRecord, { onConflict: 'id' });
      if (!fallbackErr) return true;
      console.warn(`[Supabase] Fallback upsert failed for ${table}:`, fallbackErr.message);
      return false;
    }

    if (error.code !== '42P01') {
      console.warn(`[Supabase] Upsert warning on ${table}:`, error.message);
    }
    return false;
  } catch (e: any) {
    console.warn(`[Supabase] Exception upserting to ${table}:`, e.message);
    return false;
  }
}

// ==========================================
// 1. CITIES (Villes)
// ==========================================

export function mapCityToSupabase(c: City) {
  const strId = String(c.id);
  return {
    id: strId,
    uuid: c.uuid || strId,
    name: c.name,
    country: c.country,
    currency: c.currency,
    currency_symbol: c.currencySymbol || c.currency,
    active: c.active !== undefined ? Boolean(c.active) : true,
    center: c.center || null,
    airport: c.airport || null,
    auto_schedule: c.autoSchedule || null,
    updated_at: new Date().toISOString(),
    data: c
  };
}

export async function upsertCityToSupabase(city: City): Promise<void> {
  const record = mapCityToSupabase(city);
  await resilientUpsert('cities', record, {
    id: record.id,
    uuid: record.uuid,
    name: record.name,
    country: record.country,
    currency: record.currency,
    active: record.active,
    data: city
  });
}

export async function deleteCityFromSupabase(cityId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const strId = String(cityId);
    await client.from('cities').delete().or(`id.eq.${strId},uuid.eq.${strId}`);
    await client.from('neighborhoods').delete().eq('city_id', strId);
  } catch (e: any) {
    console.warn('[Supabase] Warning deleting city:', e.message);
  }
}

export async function fetchCitiesFromSupabase(): Promise<City[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from('cities').select('*');
    if (error || !data || data.length === 0) return null;

    return data.map((row: any) => {
      if (row.data && typeof row.data === 'object' && row.data.name) {
        return {
          ...row.data,
          id: String(row.id),
          uuid: row.uuid || row.data.uuid || String(row.id)
        };
      }
      return {
        id: String(row.id),
        uuid: row.uuid || String(row.id),
        name: row.name,
        country: row.country || 'Cameroun',
        currency: row.currency || 'XAF',
        currencySymbol: row.currency_symbol || row.currency || 'FCFA',
        active: row.active !== undefined ? Boolean(row.active) : true,
        center: row.center || { lat: 4.0511, lng: 9.7679 },
        airport: row.airport || undefined,
        autoSchedule: row.auto_schedule || { enabled: false, slots: [] }
      };
    });
  } catch {
    return null;
  }
}

// ==========================================
// 2. NEIGHBORHOODS (Quartiers)
// ==========================================

export function mapNeighborhoodToSupabase(n: Neighborhood) {
  const strId = String(n.id);
  return {
    id: strId,
    uuid: n.uuid || strId,
    city_id: String(n.cityId),
    name: n.name,
    ville: n.ville || null,
    departement: n.departement || null,
    arrondissement: n.arrondissement || null,
    full_address: n.fullAddress || null,
    lat: Number(n.lat),
    lng: Number(n.lng),
    active: n.active !== undefined ? Boolean(n.active) : true,
    status: n.status || (n.active === false ? 'inactif' : 'actif'),
    zone: n.zone || null,
    zone_type: n.zoneType || null,
    district: n.district || null,
    updated_at: new Date().toISOString(),
    data: n
  };
}

export async function upsertNeighborhoodToSupabase(nb: Neighborhood): Promise<void> {
  const record = mapNeighborhoodToSupabase(nb);
  await resilientUpsert('neighborhoods', record, {
    id: record.id,
    uuid: record.uuid,
    city_id: record.city_id,
    name: record.name,
    lat: record.lat,
    lng: record.lng,
    active: record.active,
    data: nb
  });
}

export async function batchUpsertNeighborhoodsToSupabase(nbs: Neighborhood[]): Promise<number> {
  const client = getSupabaseClient();
  if (!client || !Array.isArray(nbs) || nbs.length === 0) return 0;

  try {
    const records = nbs.map(mapNeighborhoodToSupabase);
    // Insertion par blocs de 100 pour respecter les limites HTTP
    const chunkSize = 100;
    let saved = 0;
    for (let i = 0; i < records.length; i += chunkSize) {
      const slice = records.slice(i, i + chunkSize);
      const { error } = await client.from('neighborhoods').upsert(slice, { onConflict: 'id' });
      if (!error) {
        saved += slice.length;
      } else if (error.code === '42703') {
        const fallbacks = slice.map(r => ({
          id: r.id,
          uuid: r.uuid,
          city_id: r.city_id,
          name: r.name,
          lat: r.lat,
          lng: r.lng,
          active: r.active,
          data: r.data
        }));
        await client.from('neighborhoods').upsert(fallbacks, { onConflict: 'id' });
        saved += slice.length;
      }
    }
    return saved;
  } catch (e: any) {
    console.warn('[Supabase] Batch upsert neighborhoods notice:', e.message);
    return 0;
  }
}

export async function deleteNeighborhoodFromSupabase(nbId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const strId = String(nbId);
    await client.from('neighborhoods').delete().or(`id.eq.${strId},uuid.eq.${strId}`);
  } catch (e: any) {
    console.warn('[Supabase] Warning deleting neighborhood:', e.message);
  }
}

export async function clearCityNeighborhoodsInSupabase(cityId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const strId = String(cityId);
    await client.from('neighborhoods').delete().eq('city_id', strId);
  } catch (e: any) {
    console.warn('[Supabase] Warning clearing city neighborhoods:', e.message);
  }
}

export async function fetchNeighborhoodsFromSupabase(): Promise<Neighborhood[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from('neighborhoods').select('*').limit(3000);
    if (error || !data || data.length === 0) return null;

    return data.map((row: any) => {
      if (row.data && typeof row.data === 'object' && row.data.name) {
        return {
          ...row.data,
          id: String(row.id),
          uuid: row.uuid || row.data.uuid || String(row.id),
          cityId: String(row.city_id || row.data.cityId)
        };
      }
      return {
        id: String(row.id),
        uuid: row.uuid || String(row.id),
        cityId: String(row.city_id),
        name: row.name,
        ville: row.ville || undefined,
        departement: row.departement || undefined,
        arrondissement: row.arrondissement || undefined,
        fullAddress: row.full_address || undefined,
        lat: Number(row.lat),
        lng: Number(row.lng),
        active: row.active !== undefined ? Boolean(row.active) : true,
        status: row.status || (row.active === false ? 'inactif' : 'actif'),
        zone: row.zone || undefined,
        zoneType: row.zone_type || undefined,
        district: row.district || undefined
      };
    });
  } catch {
    return null;
  }
}

// ==========================================
// 3. USERS (Utilisateurs & Rôles)
// ==========================================

export function mapUserToSupabase(u: User) {
  const strId = String(u.id);
  return {
    id: strId,
    uuid: u.uuid || strId,
    name: u.name,
    email: u.email.toLowerCase().trim(),
    role: u.role || 'employe',
    active: u.active !== undefined ? Boolean(u.active) : true,
    password_hash: u.passwordHash || null,
    last_login_at: u.lastLoginAt || null,
    created_at: u.createdAt || new Date().toISOString(),
    data: { ...u }
  };
}

export async function upsertUserToSupabase(user: User): Promise<void> {
  const record = mapUserToSupabase(user);
  await resilientUpsert('users', record, {
    id: record.id,
    uuid: record.uuid,
    name: record.name,
    email: record.email,
    role: record.role,
    active: record.active,
    password_hash: record.password_hash,
    data: record.data
  });
}

export async function deleteUserFromSupabase(userId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const strId = String(userId);
    await client.from('users').delete().or(`id.eq.${strId},uuid.eq.${strId}`);
  } catch (e: any) {
    console.warn('[Supabase] Warning deleting user:', e.message);
  }
}

export async function fetchUsersFromSupabase(): Promise<User[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from('users').select('*');
    if (error || !data || data.length === 0) return null;

    return data.map((row: any) => {
      if (row.data && typeof row.data === 'object' && row.data.email) {
        return {
          ...row.data,
          id: String(row.id),
          uuid: row.uuid || row.data.uuid || String(row.id),
          passwordHash: row.password_hash || row.data.passwordHash
        };
      }
      return {
        id: String(row.id),
        uuid: row.uuid || String(row.id),
        name: row.name,
        email: row.email,
        role: row.role || 'employe',
        active: row.active !== undefined ? Boolean(row.active) : true,
        passwordHash: row.password_hash || undefined,
        createdAt: row.created_at || new Date().toISOString(),
        lastLoginAt: row.last_login_at || undefined
      };
    });
  } catch {
    return null;
  }
}

// ==========================================
// 4. CAMPAIGNS & TRIPS
// ==========================================

export function mapCampaignToSupabase(c: PricingCampaign | any) {
  const strId = String(c.id);
  return {
    id: strId,
    uuid: c.uuid || strId,
    city_id: String(c.cityId || ''),
    city_name: c.cityName || 'Douala',
    currency: c.currency || 'XAF',
    status: c.status || 'completed',
    total_pairs: c.totalPairs || 0,
    completed_pairs: c.completedPairs || 0,
    failed_pairs: c.failedPairs || 0,
    duration_seconds: c.durationSeconds || 0,
    avg_price: c.avgPrice || null,
    started_at: c.startedAt || null,
    completed_at: c.completedAt || c.finishedAt || null,
    trigger_type: c.triggerType || 'manual',
    triggered_by_user_id: c.triggeredByUserId ? String(c.triggeredByUserId) : null,
    triggered_by_user_name: c.triggeredByUserName || null,
    triggered_by_user_role: c.triggeredByUserRole || null,
    delta_stats: c.deltaStats || null,
    hero_stats: c.heroStats || null,
    trip_master_stats: c.tripMasterStats || null,
    arrondissement_stats: c.arrondissementStats || null,
    data: c
  };
}

export async function saveCampaignToSupabase(campaign: any): Promise<void> {
  const record = mapCampaignToSupabase(campaign);
  await resilientUpsert('campaigns', record, {
    id: record.id,
    uuid: record.uuid,
    city_id: record.city_id,
    city_name: record.city_name,
    status: record.status,
    started_at: record.started_at,
    completed_at: record.completed_at,
    data: campaign
  });
}

export async function deleteCampaignFromSupabase(campaignId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const strId = String(campaignId);
    await client.from('campaigns').delete().or(`id.eq.${strId},uuid.eq.${strId}`);
    await client.from('campaign_trips').delete().eq('campaign_id', strId);
    await client.from('shortages').delete().eq('campaign_id', strId);
  } catch (e: any) {
    console.warn('[Supabase] Warning deleting campaign:', e.message);
  }
}

export async function deleteAllCampaignsFromSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('campaign_trips').delete().neq('id', '');
    await client.from('shortages').delete().neq('id', '');
    await client.from('campaigns').delete().neq('id', '');
  } catch (e: any) {
    console.warn('[Supabase] Warning deleting all campaigns:', e.message);
  }
}

export async function fetchCampaignsFromSupabase(): Promise<any[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('campaigns')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50);

    if (error || !data || data.length === 0) return null;

    return data.map((row: any) => {
      if (row.data && typeof row.data === 'object' && row.data.cityName) {
        return {
          ...row.data,
          id: String(row.id),
          uuid: row.uuid || row.data.uuid || String(row.id)
        };
      }
      return {
        id: String(row.id),
        uuid: row.uuid || String(row.id),
        cityId: row.city_id,
        cityName: row.city_name,
        currency: row.currency || 'XAF',
        status: row.status,
        totalPairs: row.total_pairs || 0,
        completedPairs: row.completed_pairs || 0,
        failedPairs: row.failed_pairs || 0,
        durationSeconds: row.duration_seconds || 0,
        avgPrice: row.avg_price || 0,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        triggerType: row.trigger_type || 'manual',
        deltaStats: row.delta_stats || undefined,
        heroStats: row.hero_stats || undefined,
        tripMasterStats: row.trip_master_stats || undefined,
        arrondissementStats: row.arrondissement_stats || undefined
      };
    });
  } catch {
    return null;
  }
}

export async function initCanonicalCampaignResults(_campaignId: string, _cityName: string): Promise<void> {}

export async function saveCanonicalCampaignBatch(
  campaignId: string | number,
  chunkIndex: number,
  chunkTrips: any[],
  cityName?: string
): Promise<void> {
  const strId = String(campaignId);
  try {
    if (!fs.existsSync(TRIPS_DIR)) fs.mkdirSync(TRIPS_DIR, { recursive: true });
    const filePath = path.resolve(TRIPS_DIR, `canonical_${strId}_batch_${chunkIndex}.json`);
    fs.writeFileSync(filePath, JSON.stringify(chunkTrips, null, 2), 'utf8');
  } catch (e: any) {
    console.warn(`[Supabase/Disk] Warning saving batch ${chunkIndex}:`, e.message);
  }

  // Synchronisation en base Supabase en arrière-plan non bloquant
  const client = getSupabaseClient();
  if (client && Array.isArray(chunkTrips) && chunkTrips.length > 0) {
    try {
      const records = chunkTrips.map((t: any) => ({
        id: String(t.id || `${strId}_${t.origin}_${t.destination}`),
        campaign_id: strId,
        origin: t.origin,
        destination: t.destination,
        distance_km: t.distanceKm || t.distance_km || 0,
        duration_min: t.durationMin || t.duration_min || 0,
        jams: Boolean(t.jams),
        yango_unavailable: Boolean(t.yangoUnavailable || t.yango_unavailable),
        prices: t.prices || {},
        cheapest: t.cheapest || {},
        created_at: t.createdAt || new Date().toISOString(),
        data: t
      }));
      await client.from('campaign_trips').upsert(records, { onConflict: 'id' });
    } catch {}
  }
}

export async function saveCanonicalCampaignResults(
  campaignId: string | number,
  canonicalTrips: any[],
  _cityName: string
): Promise<void> {
  const strId = String(campaignId);
  try {
    if (!fs.existsSync(TRIPS_DIR)) fs.mkdirSync(TRIPS_DIR, { recursive: true });
    const filePath = path.resolve(TRIPS_DIR, `canonical_${strId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(canonicalTrips, null, 2), 'utf8');
  } catch (e: any) {
    console.warn(`[Supabase/Disk] Warning saving canonical results for ${strId}:`, e.message);
  }
}

export async function loadCanonicalCampaignResults(campaignId: string | number): Promise<any[]> {
  const strId = String(campaignId);
  try {
    const filePath = path.resolve(TRIPS_DIR, `canonical_${strId}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e: any) {
    console.warn(`[Supabase/Disk] Warning loading canonical results for ${strId}:`, e.message);
  }

  // Tenter de charger depuis Supabase si le fichier disque est absent
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client
        .from('campaign_trips')
        .select('*')
        .eq('campaign_id', strId)
        .limit(3000);
      if (data && data.length > 0) {
        return data.map((r: any) => (r.data && r.data.prices ? r.data : {
          id: r.id,
          origin: r.origin,
          destination: r.destination,
          distanceKm: r.distance_km,
          durationMin: r.duration_min,
          jams: r.jams,
          yangoUnavailable: r.yango_unavailable,
          prices: r.prices,
          cheapest: r.cheapest
        }));
      }
    } catch {}
  }
  return [];
}

// ==========================================
// 5. SHORTAGES (Pénuries & Ruptures)
// ==========================================

export async function upsertShortageToSupabase(shortage: any): Promise<void> {
  const strId = String(shortage.id);
  const record = {
    id: strId,
    campaign_id: String(shortage.campaignId || shortage.campaign_id),
    city_name: shortage.cityName || shortage.city_name || 'Douala',
    origin: shortage.origin,
    destination: shortage.destination,
    arrondissement_origin: shortage.arrondissementOrigin || shortage.arrondissement_origin || null,
    arrondissement_dest: shortage.arrondissementDest || shortage.arrondissement_dest || null,
    class_name: shortage.className || shortage.class_name || 'econom',
    reason: shortage.reason || 'no_free_cars_nearby',
    timestamp: shortage.timestamp || new Date().toISOString(),
    distance_km: shortage.distanceKm || shortage.distance_km || null,
    waiting_minutes: shortage.waitingMinutes || shortage.waiting_minutes || null,
    data: shortage
  };

  await resilientUpsert('shortages', record, {
    id: record.id,
    campaign_id: record.campaign_id,
    city_name: record.city_name,
    origin: record.origin,
    destination: record.destination,
    reason: record.reason,
    timestamp: record.timestamp,
    data: shortage
  });
}

export async function deleteShortageFromSupabase(shortageId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const strId = String(shortageId);
    await client.from('shortages').delete().eq('id', strId);
  } catch (e: any) {
    console.warn('[Supabase] Warning deleting shortage:', e.message);
  }
}

// ==========================================
// 6. SYNCHRONISATION BIDIRECTIONNELLE
// ==========================================

export async function syncAllDataWithSupabase(direction: 'push' | 'pull' = 'push'): Promise<{
  success: boolean;
  message: string;
  counts: { cities: number; neighborhoods: number; users: number; campaigns: number };
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase n’est pas configuré. Veuillez entrer votre URL et clé Anon.',
      counts: { cities: 0, neighborhoods: 0, users: 0, campaigns: 0 }
    };
  }

  if (direction === 'pull') {
    // Supabase -> Local
    const fetchedCities = await fetchCitiesFromSupabase();
    let citiesCount = 0;
    if (fetchedCities && fetchedCities.length > 0) {
      cities.splice(0, cities.length, ...fetchedCities);
      saveCitiesDiskBackup();
      citiesCount = fetchedCities.length;
    }

    const fetchedNbs = await fetchNeighborhoodsFromSupabase();
    let nbsCount = 0;
    if (fetchedNbs && fetchedNbs.length > 0) {
      setNeighborhoods(fetchedNbs);
      saveNeighborhoodsDiskBackup();
      nbsCount = fetchedNbs.length;
    }

    const fetchedUsers = await fetchUsersFromSupabase();
    let usersCount = 0;
    if (fetchedUsers && fetchedUsers.length > 0) {
      users.splice(0, users.length, ...fetchedUsers);
      saveUsersDiskBackup();
      usersCount = fetchedUsers.length;
    }

    const fetchedCamps = await fetchCampaignsFromSupabase();
    let campsCount = 0;
    if (fetchedCamps && fetchedCamps.length > 0) {
      memoryCampaigns.splice(0, memoryCampaigns.length, ...fetchedCamps);
      saveLocalCampaignsDiskBackup();
      campsCount = fetchedCamps.length;
    }

    return {
      success: true,
      message: `Données importées depuis Supabase : ${citiesCount} ville(s), ${nbsCount} quartier(s), ${usersCount} utilisateur(s), ${campsCount} campagne(s).`,
      counts: { cities: citiesCount, neighborhoods: nbsCount, users: usersCount, campaigns: campsCount }
    };
  } else {
    // Local -> Supabase (Push)
    let citiesCount = 0;
    for (const c of cities) {
      await upsertCityToSupabase(c);
      citiesCount++;
    }

    const nbsCount = await batchUpsertNeighborhoodsToSupabase(neighborhoods);

    let usersCount = 0;
    for (const u of users) {
      await upsertUserToSupabase(u);
      usersCount++;
    }

    let campsCount = 0;
    for (const camp of memoryCampaigns) {
      await saveCampaignToSupabase(camp);
      campsCount++;
    }

    return {
      success: true,
      message: `Synchronisation vers Supabase réussie : ${citiesCount} ville(s), ${nbsCount} quartier(s), ${usersCount} utilisateur(s), ${campsCount} campagne(s).`,
      counts: { cities: citiesCount, neighborhoods: nbsCount, users: usersCount, campaigns: campsCount }
    };
  }
}

// Initialisation au démarrage du serveur : amorçage automatique si Supabase est actif
export async function bootstrapSupabaseData() {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    // Vérifier si des villes existent en base Supabase
    const { data: dbCities, error } = await client.from('cities').select('id').limit(1);
    if (!error && dbCities && dbCities.length > 0) {
      console.log('[Supabase Sync] Données distantes détectées dans Supabase, hydratation...');
      const freshCities = await fetchCitiesFromSupabase();
      if (freshCities && freshCities.length > 0) {
        cities.splice(0, cities.length, ...freshCities);
        saveCitiesDiskBackup();
      }
      const freshNbs = await fetchNeighborhoodsFromSupabase();
      if (freshNbs && freshNbs.length > 0) {
        setNeighborhoods(freshNbs);
        saveNeighborhoodsDiskBackup();
      }
    } else if (!error && (!dbCities || dbCities.length === 0) && cities.length > 0) {
      console.log('[Supabase Sync] Base Supabase vide, amorçage initial avec les données locales...');
      await syncAllDataWithSupabase('push');
    }
  } catch (e: any) {
    console.warn('[Supabase Sync] Notice during initial bootstrap:', e.message);
  }
}

// Lancement automatique au démarrage si configuré
bootstrapSupabaseData().catch(() => {});

// ==========================================
// 7. SCRIPT DDL SQL SUPABASE (Copier-Coller)
// ==========================================

export function getSupabaseSqlSchema(): string {
  return `-- ============================================================
-- SCRIPT DDL SUPABASE POSTGRESQL - CITRINE PRICING VTC CAMEROUN
-- À exécuter dans l'éditeur SQL de votre Dashboard Supabase
-- ============================================================

-- 1. Table des Villes (cities)
CREATE TABLE IF NOT EXISTS public.cities (
  id TEXT PRIMARY KEY,
  uuid TEXT UNIQUE,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Cameroun',
  currency TEXT NOT NULL DEFAULT 'XAF',
  currency_symbol TEXT DEFAULT 'FCFA',
  active BOOLEAN DEFAULT true,
  center JSONB,
  airport JSONB,
  auto_schedule JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB
);

-- 2. Table des Quartiers (neighborhoods)
CREATE TABLE IF NOT EXISTS public.neighborhoods (
  id TEXT PRIMARY KEY,
  uuid TEXT UNIQUE,
  city_id TEXT NOT NULL,
  name TEXT NOT NULL,
  ville TEXT,
  departement TEXT,
  arrondissement TEXT,
  full_address TEXT,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'actif',
  zone TEXT,
  zone_type TEXT,
  district TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB
);

CREATE INDEX IF NOT EXISTS idx_neighborhoods_city ON public.neighborhoods(city_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_active ON public.neighborhoods(active);

-- 3. Table des Utilisateurs (users)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  uuid TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'employe',
  active BOOLEAN DEFAULT true,
  password_hash TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB
);

-- 4. Table des Campagnes de Pricing (campaigns)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id TEXT PRIMARY KEY,
  uuid TEXT UNIQUE,
  city_id TEXT NOT NULL,
  city_name TEXT NOT NULL,
  currency TEXT DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'completed',
  total_pairs INTEGER DEFAULT 0,
  completed_pairs INTEGER DEFAULT 0,
  failed_pairs INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  avg_price NUMERIC,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  trigger_type TEXT DEFAULT 'manual',
  triggered_by_user_id TEXT,
  triggered_by_user_name TEXT,
  triggered_by_user_role TEXT,
  delta_stats JSONB,
  hero_stats JSONB,
  trip_master_stats JSONB,
  arrondissement_stats JSONB,
  data JSONB
);

CREATE INDEX IF NOT EXISTS idx_campaigns_started ON public.campaigns(started_at DESC);

-- 5. Table des Trajets et Résultats (campaign_trips)
CREATE TABLE IF NOT EXISTS public.campaign_trips (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  distance_km NUMERIC,
  duration_min NUMERIC,
  jams BOOLEAN DEFAULT false,
  yango_unavailable BOOLEAN DEFAULT false,
  prices JSONB,
  cheapest JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB
);

CREATE INDEX IF NOT EXISTS idx_trips_campaign ON public.campaign_trips(campaign_id);

-- 6. Table des Pénuries Détectées (shortages)
CREATE TABLE IF NOT EXISTS public.shortages (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  city_name TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  arrondissement_origin TEXT,
  arrondissement_dest TEXT,
  class_name TEXT DEFAULT 'econom',
  reason TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  distance_km NUMERIC,
  waiting_minutes NUMERIC,
  data JSONB
);

CREATE INDEX IF NOT EXISTS idx_shortages_campaign ON public.shortages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_shortages_time ON public.shortages(timestamp DESC);

-- 7. Politiques de Sécurité (RLS activé pour protection avec accès Anon)
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.cities FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.cities FOR ALL USING (true);

CREATE POLICY "Allow public read access" ON public.neighborhoods FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.neighborhoods FOR ALL USING (true);

CREATE POLICY "Allow public read access" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.users FOR ALL USING (true);

CREATE POLICY "Allow public read access" ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.campaigns FOR ALL USING (true);

CREATE POLICY "Allow public read access" ON public.campaign_trips FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.campaign_trips FOR ALL USING (true);

CREATE POLICY "Allow public read access" ON public.shortages FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.shortages FOR ALL USING (true);
`;
}
