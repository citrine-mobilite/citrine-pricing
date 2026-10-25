import 'dotenv/config';
import { randomUUID } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';
import { City, Neighborhood, PricingCampaign, CanonicalTrip, User, TripResult } from '../types.js';
import type { CampaignShortageRecord } from './shortageStore.js';

const { Pool } = pg;

function assertSupabaseResult<T>(result: { data: T | null; error: any }, context: string): T | null {
  if (result.error) {
    const message = result.error?.message || JSON.stringify(result.error);
    const rlsHint = /new row violates row-level security policy/i.test(message)
      ? ' RLS policy violation: the request is likely using the anon key instead of the service-role key. Set SUPABASE_SERVICE_ROLE_KEY in the server environment and restart the app.'
      : '';
    throw new Error(`[Supabase] ${context}: ${message}${rlsHint}`);
  }
  return result.data ?? null;
}

export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
export const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
export const DATABASE_URL = process.env.DATABASE_URL || '';

const HAS_SERVICE_ROLE_KEY = Boolean(SUPABASE_SERVICE_ROLE_KEY);
const SUPABASE_SERVER_KEY = HAS_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;

if (!HAS_SERVICE_ROLE_KEY && SUPABASE_URL) {
  console.warn('[Supabase] SUPABASE_SERVICE_ROLE_KEY is not configured. Writes will use the anon key.');
}

export const supabase: SupabaseClient = (SUPABASE_URL && SUPABASE_SERVER_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVER_KEY, {
      auth: { persistSession: false }
    })
  : createClient('https://placeholder.supabase.co', 'placeholder', { auth: { persistSession: false } });

export const pgPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    })
  : ({
      query: async () => ({ rows: [] }),
      on: () => {}
    } as unknown as InstanceType<typeof Pool>);

if (DATABASE_URL && pgPool && typeof pgPool.on === 'function') {
  pgPool.on('error', (err) => {
    console.warn('[PostgreSQL Pool Warning]:', err.message);
  });
}

if (SUPABASE_URL) {
  console.log('[Supabase] Initialisé avec succès sur:', SUPABASE_URL);
}

// ----------------- VILLES ----------------- //

export async function fetchCitiesFromSupabase(): Promise<City[]> {
  try {
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        uuid: row.uuid,
        name: row.name,
        country: row.country,
        currency: row.currency,
        currencySymbol: row.currency_symbol || 'FCFA',
        center: row.center || { lat: 4.0511, lng: 9.7679 },
        airport: row.airport || undefined,
        active: Boolean(row.active),
        autoSchedule: row.auto_schedule || { enabled: false, slots: [] }
      }));
    }
  } catch (err: any) {
    console.warn('[Supabase] Erreur lecture villes:', err.message);
  }
  return [];
}

export async function upsertCityInSupabase(city: City): Promise<void> {
  try {
    const payload = {
      id: typeof city.id === 'number' ? city.id : undefined,
      uuid: city.uuid || `city_${city.id}`,
      name: city.name,
      country: city.country || 'Cameroun',
      currency: city.currency || 'XAF',
      currency_symbol: city.currencySymbol || 'FCFA',
      center: city.center,
      airport: city.airport || null,
      active: city.active ?? true,
      auto_schedule: city.autoSchedule || { enabled: false, slots: [] }
    };
    const { data, error } = await supabase.from('cities').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase] Erreur écriture ville (non bloquant):', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase] Erreur réseau écriture ville (mode résilient local):', err?.message || err);
  }
}

export async function deleteCityFromSupabase(cityIdOrUuid: string | number): Promise<void> {
  try {
    const isNum = typeof cityIdOrUuid === 'number' || /^\d+$/.test(String(cityIdOrUuid));
    if (isNum) {
      await pgPool.query('DELETE FROM public.neighborhoods WHERE city_id = $1', [String(cityIdOrUuid)]);
      await pgPool.query('DELETE FROM public.cities WHERE id = $1', [Number(cityIdOrUuid)]);
    } else {
      await pgPool.query('DELETE FROM public.neighborhoods WHERE city_id = $1', [String(cityIdOrUuid)]);
      await pgPool.query('DELETE FROM public.cities WHERE uuid = $1', [String(cityIdOrUuid)]);
    }
  } catch (err: any) {
    console.warn('[Supabase] Erreur suppression ville:', err.message);
  }
}

// ----------------- QUARTIERS ----------------- //

export async function fetchNeighborhoodsFromSupabase(cityId?: string): Promise<Neighborhood[]> {
  try {
    let query = supabase.from('neighborhoods').select('*').order('name', { ascending: true });
    if (cityId) {
      query = query.eq('city_id', String(cityId));
    }
    const { data, error } = await query;
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        uuid: row.uuid,
        cityId: String(row.city_id),
        name: row.name,
        ville: row.ville,
        departement: row.departement,
        arrondissement: row.arrondissement,
        fullAddress: row.full_address,
        lat: Number(row.lat),
        lng: Number(row.lng),
        active: Boolean(row.active),
        status: row.status,
        zone: row.zone,
        zoneType: row.zone_type || 'residential',
        district: row.district,
        orderIndex: row.order_index || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }
  } catch (err: any) {
    console.warn('[Supabase] Erreur lecture quartiers:', err.message);
  }
  return [];
}

function getStableNeighborhoodId(nb: Neighborhood): number {
  const rawSeed = String(nb.uuid || nb.id || `${nb.cityId}:${nb.name}:${nb.lat}:${nb.lng}`);
  let hash = 0;
  for (let i = 0; i < rawSeed.length; i++) {
    hash = (hash * 31 + rawSeed.charCodeAt(i)) >>> 0;
  }
  return (hash % 2147483647) + 1;
}

export async function upsertNeighborhoodsInSupabase(nbs: Neighborhood[]): Promise<void> {
  if (!nbs || nbs.length === 0) return;
  try {
    const rows = nbs.map((nb) => {
      const stableId = typeof nb.id === 'number' && Number.isFinite(nb.id) ? nb.id : getStableNeighborhoodId(nb);
      const uuid = nb.uuid && nb.uuid.trim() ? nb.uuid.replace(/^nb_(?:[a-z0-9]+_)?/i, '') : randomUUID();

      return {
        id: stableId,
        uuid,
        city_id: String(nb.cityId),
        name: nb.name,
        ville: nb.ville || null,
        departement: nb.departement || null,
        arrondissement: nb.arrondissement || null,
        full_address: nb.fullAddress || null,
        lat: nb.lat,
        lng: nb.lng,
        active: nb.active ?? true,
        status: nb.status ? String(nb.status) : null,
        zone: nb.zone || null,
        zone_type: nb.zoneType || 'residential',
        district: nb.district || null,
        order_index: nb.orderIndex || 0,
        updated_at: new Date().toISOString()
      };
    });
    const { data, error } = await supabase.from('neighborhoods').upsert(rows, { onConflict: 'uuid' });
    if (error) {
      console.warn('[Supabase] Erreur écriture quartiers (non bloquant):', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase] Erreur réseau écriture quartiers (mode résilient local):', err?.message || err);
  }
}

export async function deleteNeighborhoodFromSupabase(nbIdOrUuid: string | number): Promise<void> {
  try {
    const isNum = typeof nbIdOrUuid === 'number' || /^\d+$/.test(String(nbIdOrUuid));
    if (isNum) {
      await pgPool.query('DELETE FROM public.neighborhoods WHERE id = $1', [Number(nbIdOrUuid)]);
    } else {
      await pgPool.query('DELETE FROM public.neighborhoods WHERE uuid = $1', [String(nbIdOrUuid)]);
    }
  } catch (err: any) {
    console.warn('[Supabase] Erreur suppression quartier:', err.message);
  }
}

export async function deleteNeighborhoodsByCityFromSupabase(cityId: string | number): Promise<void> {
  try {
    await pgPool.query('DELETE FROM public.neighborhoods WHERE city_id = $1', [String(cityId)]);
  } catch (err: any) {
    console.warn('[Supabase] Erreur suppression quartiers de la ville:', err.message);
  }
}

// ----------------- UTILISATEURS ----------------- //

export async function fetchUsersFromSupabase(): Promise<User[]> {
  try {
    const { data, error } = await supabase.from('users').select('*').order('id', { ascending: true });
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map((u: any) => ({
        id: u.id,
        uuid: u.uuid,
        name: u.name,
        email: u.email,
        role: u.role || 'employe',
        active: Boolean(u.active),
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
        passwordHash: u.password_hash
      }));
    }
  } catch (err: any) {
    console.warn('[Supabase] Erreur lecture utilisateurs:', err.message);
  }
  return [];
}

export async function upsertUserInSupabase(user: User): Promise<void> {
  try {
    const payload = {
      id: typeof user.id === 'number' ? user.id : undefined,
      uuid: user.uuid || `usr_${user.id}`,
      name: user.name,
      email: user.email,
      role: user.role || 'employe',
      active: user.active ?? true,
      password_hash: user.passwordHash || null,
      last_login_at: user.lastLoginAt || new Date().toISOString()
    };
    const { data, error } = await supabase.from('users').upsert(payload, { onConflict: 'email' });
    if (error) {
      console.warn('[Supabase] Erreur écriture utilisateur (non bloquant):', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase] Erreur réseau écriture utilisateur (mode résilient local):', err?.message || err);
  }
}

export async function deleteUserFromSupabase(userIdOrUuid: string | number): Promise<void> {
  try {
    const isNum = typeof userIdOrUuid === 'number' || /^\d+$/.test(String(userIdOrUuid));
    if (isNum) {
      await pgPool.query('DELETE FROM public.users WHERE id = $1', [Number(userIdOrUuid)]);
    } else {
      await pgPool.query('DELETE FROM public.users WHERE uuid = $1', [String(userIdOrUuid)]);
    }
  } catch (err: any) {
    console.warn('[Supabase] Erreur suppression utilisateur:', err.message);
  }
}

// ----------------- CAMPAGNES ----------------- //

function isMissingColumnError(error: any): boolean {
  const message = error?.message || error?.details || '';
  return /Could not find the '.*' column|column .* does not exist|does not exist in the schema cache/i.test(message);
}

function isSchemaCompatibilityError(error: any): boolean {
  const message = error?.message || error?.details || '';
  return isMissingColumnError(error) || /no unique or exclusion constraint matching the ON CONFLICT specification/i.test(message);
}

function toLegacyCompatibleRow(row: Record<string, any>, omitKeys: string[] = []): Record<string, any> {
  return Object.fromEntries(Object.entries(row).filter(([key, value]) => {
    if (omitKeys.includes(key)) return false;
    return value !== undefined;
  }));
}

function removeUnsupportedColumns(row: Record<string, any>, unsupportedKeys: string[]): Record<string, any> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !unsupportedKeys.includes(key) && row[key] !== undefined));
}

function getNumericCampaignId(campaignId: string | number): number | undefined {
  if (typeof campaignId === 'number' && Number.isFinite(campaignId)) return campaignId;
  const trimmed = String(campaignId).trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
}

function getCheapestShortageProvider(record: CampaignShortageRecord): string | null {
  const prices = [
    { provider: 'yango', price: record.priceYangoEco },
    { provider: 'heroCab', price: record.priceHeroEco }
  ].filter((entry): entry is { provider: string; price: number } =>
    typeof entry.price === 'number' && Number.isFinite(entry.price) && entry.price > 0
  );

  prices.sort((a, b) => a.price - b.price);
  return prices[0]?.provider || null;
}

export async function fetchCampaignsFromSupabase(): Promise<PricingCampaign[]> {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('started_at', { ascending: false });

    if (error) throw error;
    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        uuid: row.uuid,
        cityId: row.city_id,
        cityName: row.city_name,
        currency: row.currency || 'XAF',
        triggerType: row.trigger_type || 'manual',
        triggeredByUserId: row.triggered_by_user_id,
        triggeredByUserName: row.triggered_by_user_name,
        status: row.status,
        totalPairs: row.total_pairs || 0,
        completedPairs: row.completed_pairs || 0,
        failedPairs: row.failed_pairs || 0,
        durationSeconds: row.duration_seconds || 0,
        avgPrice: row.avg_price || 0,
        avgDistanceKm: Number(row.avg_distance_km) || 0,
        avgPricePerKm: row.avg_price_per_km || 0,
        heroStats: row.hero_stats || undefined,
        tripMasterStats: row.trip_master_stats || undefined,
        arrondissementStats: row.arrondissement_stats || undefined,
        hasJamsCount: row.has_jams_count || 0,
        yangoShortageCount: row.yango_shortage_count || 0,
        canonicalTripsCount: row.canonical_trips_count || 0,
        logs: Array.isArray(row.logs) ? row.logs : [],
        comment: row.comment,
        timeSlotOverride: row.time_slot_override,
        startedAt: row.started_at,
        finishedAt: row.finished_at
      }));
    }
  } catch (err: any) {
    console.warn('[Supabase] Erreur lecture campagnes:', err.message);
  }
  return [];
}

export async function upsertCampaignInSupabase(camp: PricingCampaign): Promise<void> {
  try {
    const totalPairs = Math.max(0, Number(camp.totalPairs) || 0);
    const completedPairs = Math.max(0, Number(camp.completedPairs) || 0);
    const normalizedCamp: PricingCampaign = {
      ...camp,
      totalPairs,
      completedPairs,
      failedPairs: Math.max(0, Number(camp.failedPairs) || 0)
    };

    const campaignUuid = (normalizedCamp.uuid || randomUUID()).replace(/^campaign_[a-z0-9-]+$/i, '').trim() || randomUUID();
    const payload = {
      id: typeof normalizedCamp.id === 'number' ? normalizedCamp.id : undefined,
      uuid: campaignUuid,
      city_id: String(normalizedCamp.cityId),
      city_name: normalizedCamp.cityName,
      currency: normalizedCamp.currency || 'XAF',
      trigger_type: normalizedCamp.triggerType || 'manual',
      triggered_by_user_id: normalizedCamp.triggeredByUserId ? String(normalizedCamp.triggeredByUserId) : null,
      triggered_by_user_name: normalizedCamp.triggeredByUserName || null,
      status: normalizedCamp.status,
      total_pairs: normalizedCamp.totalPairs || 0,
      completed_pairs: normalizedCamp.completedPairs || 0,
      failed_pairs: normalizedCamp.failedPairs || 0,
      duration_seconds: normalizedCamp.durationSeconds || 0,
      avg_price: normalizedCamp.avgPrice || 0,
      avg_distance_km: normalizedCamp.avgDistanceKm || 0,
      avg_price_per_km: normalizedCamp.avgPricePerKm || 0,
      hero_stats: normalizedCamp.heroStats || null,
      trip_master_stats: normalizedCamp.tripMasterStats || null,
      arrondissement_stats: normalizedCamp.arrondissementStats || null,
      has_jams_count: normalizedCamp.hasJamsCount || 0,
      yango_shortage_count: normalizedCamp.yangoShortageCount || 0,
      canonical_trips_count: normalizedCamp.canonicalTripsCount || 0,
      logs: normalizedCamp.logs || [],
      comment: normalizedCamp.comment || null,
      time_slot_override: normalizedCamp.timeSlotOverride || null,
      started_at: normalizedCamp.startedAt ? new Date(normalizedCamp.startedAt).toISOString() : new Date().toISOString(),
      finished_at: normalizedCamp.finishedAt ? new Date(normalizedCamp.finishedAt).toISOString() : null
    };

    const { data, error } = await supabase.from('campaigns').upsert(payload, { onConflict: 'uuid' });
    if (error) {
      console.warn('[Supabase] Erreur écriture campagne (non bloquant):', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase] Erreur réseau écriture campagne (mode résilient local):', err?.message || err);
  }
}

// ----------------- TRAJETS ET RÉSULTATS ----------------- //

/**
 * Insertion en masse (requête unique haute performance) de l'ensemble des trajets
 * exécutée UNIQUEMENT à la finalisation de la campagne pour garantir une rapidité maximale.
 */
export async function bulkInsertTripsInPostgres(
  campaignId: string | number,
  cityName: string,
  canonicalTrips: CanonicalTrip[],
  _campaignUuid?: string
): Promise<number> {
  if (!Array.isArray(canonicalTrips) || canonicalTrips.length === 0) return 0;

  const campIdStr = String(campaignId);
  const rows = canonicalTrips.map((t) => ({
    uuid: t.uuid || randomUUID(),
    campaign_id: campIdStr,
    city_name: cityName,
    origin: t.origin,
    destination: t.destination,
    distance_km: t.distanceKm || 0,
    duration_minutes: t.durationMin || 0,
    jams: Boolean(t.jams),
    yango_unavailable: Boolean(t.yangoUnavailable),
    yango_waiting_minutes: t.yangoWaitingMinutes || null,
    yango_unavailable_classes: Array.isArray(t.yangoUnavailableClasses) ? t.yangoUnavailableClasses : null,
    prices: t.prices || {},
    cheapest: t.cheapest || {},
    status: t.status || 'success',
    created_at: t.createdAt || new Date().toISOString()
  }));

  const startTime = Date.now();

  // 1. Priorité absolue : requête SQL unique d'insertion en masse ultra-rapide via PostgreSQL direct (json_to_recordset)
  try {
    const massInsertSql = `
      INSERT INTO public.trips (
        uuid, campaign_id, city_name, origin, destination,
        distance_km, duration_minutes, jams, yango_unavailable,
        yango_waiting_minutes, yango_unavailable_classes, prices,
        cheapest, status, created_at
      )
      SELECT
        coalesce(uuid, gen_random_uuid()::text),
        campaign_id,
        city_name,
        origin,
        destination,
        coalesce(distance_km, 0),
        coalesce(duration_minutes, 0),
        coalesce(jams, false),
        coalesce(yango_unavailable, false),
        yango_waiting_minutes,
        yango_unavailable_classes,
        coalesce(prices, '{}'::jsonb),
        coalesce(cheapest, '{}'::jsonb),
        coalesce(status, 'success'),
        coalesce(created_at, now())
      FROM json_to_recordset($1::json) AS x(
        uuid text,
        campaign_id text,
        city_name text,
        origin text,
        destination text,
        distance_km numeric,
        duration_minutes integer,
        jams boolean,
        yango_unavailable boolean,
        yango_waiting_minutes integer,
        yango_unavailable_classes text[],
        prices jsonb,
        cheapest jsonb,
        status text,
        created_at timestamptz
      )
      ON CONFLICT (uuid) DO NOTHING
    `;

    const res = await pgPool.query(massInsertSql, [JSON.stringify(rows)]);
    console.log(`[PostgreSQL Bulk] ${res.rowCount ?? rows.length} trajets insérés en masse en ${Date.now() - startTime}ms (campagne ${campIdStr}).`);
    return res.rowCount ?? rows.length;
  } catch (directErr: any) {
    console.warn(`[PostgreSQL Bulk] Avertissement requête directe pgPool (${directErr.message}), bascule vers API Supabase...`);
  }

  // 2. Repli robuste : insertion par lot via client Supabase
  try {
    const { data, error } = await supabase.from('trips').upsert(rows, { onConflict: 'uuid' });
    if (error) {
      if (isSchemaCompatibilityError(error)) {
        const strippedRows = rows.map((r) => removeUnsupportedColumns(r, ['uuid']));
        await supabase.from('trips').insert(strippedRows);
      } else {
        throw error;
      }
    }
    console.log(`[Supabase Bulk] ${rows.length} trajets insérés via API en ${Date.now() - startTime}ms (campagne ${campIdStr}).`);
    return rows.length;
  } catch (fallbackErr: any) {
    console.warn(`[Supabase Bulk] Erreur insertion de secours trips ${campIdStr}:`, fallbackErr.message);
    return 0;
  }
}

// Rétro-compatibilité : alias vers l'insertion optimisée
export const saveCampaignTripChunkInSupabase = bulkInsertTripsInPostgres;

export async function saveCampaignResultsInSupabase(
  campaignId: string | number,
  cityName: string,
  canonicalTrips: CanonicalTrip[],
  campaignUuid?: string
): Promise<void> {
  const campIdStr = String(campaignId);
  const startMs = Date.now();
  try {
    const resultUuid = (campaignUuid || randomUUID()).replace(/^campaign[_:-]?/i, '').trim() || randomUUID();
    const payload = {
      uuid: resultUuid,
      campaign_id: campIdStr,
      city_name: cityName,
      total_trips: canonicalTrips.length,
      canonical_trips: canonicalTrips,
      saved_at: new Date().toISOString()
    };

    // 1. Enregistrement unique de campaign_results (rapide, direct SQL prioritaire)
    let savedResults = false;
    try {
      const sqlResults = `
        INSERT INTO public.campaign_results (
          uuid, campaign_id, city_name, total_trips, canonical_trips, saved_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (campaign_id) DO UPDATE SET
          uuid = EXCLUDED.uuid,
          city_name = EXCLUDED.city_name,
          total_trips = EXCLUDED.total_trips,
          canonical_trips = EXCLUDED.canonical_trips,
          saved_at = EXCLUDED.saved_at
      `;
      await pgPool.query(sqlResults, [
        payload.uuid,
        payload.campaign_id,
        payload.city_name,
        payload.total_trips,
        JSON.stringify(payload.canonical_trips),
        payload.saved_at
      ]);
      savedResults = true;
    } catch (pgErr: any) {
      console.warn(`[PostgreSQL] Note campaign_results via pgPool (${pgErr.message}), bascule vers API Supabase...`);
    }

    if (!savedResults) {
      const { data, error } = await supabase
        .from('campaign_results')
        .upsert(payload, { onConflict: 'campaign_id' });
      assertSupabaseResult({ data, error }, `ecriture campaign_results ${campIdStr}`);
    }

    // 2. Enregistrement en masse de tous les trajets individuels en 1 seule requête SQL
    await bulkInsertTripsInPostgres(campaignId, cityName, canonicalTrips, resultUuid);
    console.log(`[Supabase/Postgres] Résultats et ${canonicalTrips.length} trajets finalisés en masse avec succès en ${Date.now() - startMs}ms pour la campagne ${campIdStr}.`);
  } catch (err: any) {
    console.warn('[Supabase] Erreur enregistrement trajets:', err.message);
    throw err;
  }
}

export async function fetchCampaignResultsFromSupabase(campaignId: string | number): Promise<CanonicalTrip[]> {
  const campIdStr = String(campaignId);
  try {
    const queries = [
      () => supabase.from('campaign_results').select('canonical_trips').eq('campaign_id', campIdStr).limit(1),
      () => supabase.from('campaign_results').select('canonical_trips').eq('uuid', campIdStr).limit(1)
    ];

    for (const query of queries) {
      const { data, error } = await query();
      if (error && error.code !== 'PGRST116') {
        if (!isMissingColumnError(error)) throw error;
        continue;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row && Array.isArray(row.canonical_trips) && row.canonical_trips.length > 0) {
        return row.canonical_trips as CanonicalTrip[];
      }
    }
  } catch (err: any) {
    console.warn('[Supabase] Erreur lecture trajets campagne:', err.message);
  }
  return [];
}

export async function saveCampaignShortagesInSupabase(
  campaignId: string | number,
  _campaignUuid: string | undefined,
  cityName: string,
  shortageRecords: CampaignShortageRecord[]
): Promise<void> {
  if (!Array.isArray(shortageRecords) || shortageRecords.length === 0) return;

  const campIdStr = String(campaignId);
  const rows = shortageRecords.map((record) => ({
    uuid: record.uuid || randomUUID(),
    source_record_id: record.id != null ? String(record.id) : null,
    campaign_id: campIdStr,
    city_id: record.cityId != null ? String(record.cityId) : null,
    city_name: record.cityName || cityName,
    origin: record.origin || null,
    destination: record.destination || null,
    start_neighborhood_id: record.startNeighborhoodId != null ? String(record.startNeighborhoodId) : null,
    end_neighborhood_id: record.endNeighborhoodId != null ? String(record.endNeighborhoodId) : null,
    arrondissement_origin: record.arrondissementOrigin || null,
    arrondissement_dest: record.arrondissementDest || null,
    time_slot: record.timeSlot || null,
    distance_km: Number(record.distanceKm || 0),
    duration_minutes: Number(record.durationMinutes || 0),
    waiting_time_minutes: Number(record.waitingMinutes ?? 0),
    unavailable_classes: Array.isArray(record.unavailableClasses) ? record.unavailableClasses : [],
    cheapest_available_provider: getCheapestShortageProvider(record),
    jams: Boolean(record.jams),
    price_yango_eco: record.priceYangoEco ?? null,
    price_hero_eco: record.priceHeroEco ?? null,
    prices: {
      yango: { eco: record.priceYangoEco ?? null },
      heroCab: { eco: record.priceHeroEco ?? null },
      jams: Boolean(record.jams),
      timeSlot: record.timeSlot || null,
      arrondissementOrigin: record.arrondissementOrigin || null,
      arrondissementDest: record.arrondissementDest || null
    },
    raw_payload: record,
    created_at: record.timestamp || new Date().toISOString()
  }));

  const cleanup = await supabase.from('shortages').delete().eq('campaign_id', campIdStr);
  if (cleanup.error && !isMissingColumnError(cleanup.error)) {
    console.warn(`[Supabase] Warning nettoyage shortages ${campIdStr}:`, cleanup.error.message);
  }

  const { data, error } = await supabase.from('shortages').insert(rows);
  assertSupabaseResult({ data, error }, `écriture shortages ${campIdStr}`);
  console.log(`[Supabase] ${rows.length} trajets en pénurie enregistrés pour la campagne ${campIdStr}.`);
}

export async function deleteCampaignInSupabase(campaignId: string | number): Promise<void> {
  const campIdStr = String(campaignId);
  try {
    const numericCampaignId = getNumericCampaignId(campaignId);
    const deleteCampaignById = numericCampaignId !== undefined ? supabase.from('campaigns').delete().eq('id', numericCampaignId) : null;
    const deleteCampaignByUuid = supabase.from('campaigns').delete().eq('uuid', campIdStr);
    const deleteCampaignResultsByCampaignId = supabase.from('campaign_results').delete().eq('campaign_id', campIdStr);
    const deleteCampaignResultsByUuid = supabase.from('campaign_results').delete().eq('uuid', campIdStr);

    await Promise.allSettled([
      supabase.from('trips').delete().eq('campaign_id', campIdStr),
      deleteCampaignResultsByCampaignId,
      deleteCampaignResultsByUuid,
      supabase.from('shortages').delete().eq('campaign_id', campIdStr),
      deleteCampaignById,
      deleteCampaignByUuid
    ]);
    console.log(`[Supabase] Campagne ${campIdStr} supprimée.`);
  } catch (err: any) {
    console.warn('[Supabase] Erreur suppression campagne:', err.message);
  }
}
