import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User, City, Neighborhood, PricingCampaign, TripResult, ActivePricingSession, CanonicalTrip } from '../types.js';
import {
  fetchCitiesFromMySQL,
  upsertCityInMySQL,
  fetchNeighborhoodsFromMySQL,
  upsertNeighborhoodsInMySQL,
  fetchUsersFromMySQL,
  upsertUserInMySQL,
  fetchCampaignsFromMySQL,
  upsertCampaignInMySQL,
  saveCampaignResultsInMySQL,
  fetchCampaignResultsFromMySQL,
  deleteCampaignInMySQL,
  insertHistoryInMySQL,
  fetchHistoryFromMySQL,
  clearHistoryInMySQL,
  isMySQLConnected
} from './mysql.js';

import { getNextSequence } from './counters.js';

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const CAMPAIGNS_FILE = path.resolve(DATA_DIR, 'campaigns.json');
const DATA_NEIGHBORHOODS_FILE = path.resolve(DATA_DIR, 'neighborhoods.json');
const CITIES_FILE = path.resolve(DATA_DIR, 'cities.json');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');

function loadInitialUsers(): User[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

export let users: User[] = loadInitialUsers();
export let cities: City[] = [];
export let neighborhoods: Neighborhood[] = [];
export let memoryCampaigns: PricingCampaign[] = [];
export const memoryCampaignTrips: Record<string, TripResult[]> = {};
export const memoryCampaignCanonicalTrips: Record<string, CanonicalTrip[]> = {};
export let historyRecords: any[] = [];

export const activePricingSessions = new Map<string, ActivePricingSession>();

// Requêtes directes systématiques sans blocage de cache
export function isCitiesCacheValid(): boolean {
  return false;
}
export function touchCitiesCache() {}
export function invalidateCitiesCache() {}

export function isNeighborhoodsCacheValid(_cityId?: string): boolean {
  return false;
}
export function touchNeighborhoodsCache(_cityId?: string) {}
export function invalidateNeighborhoodsCache(_cityId?: string) {}

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

export async function saveCitiesDiskBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CITIES_FILE, JSON.stringify(cities, null, 2), 'utf8');
    await Promise.all(cities.map(c => upsertCityInMySQL(c))).catch(() => {});
  } catch (e: any) {
    console.warn('[Storage] Warning saving cities:', e.message);
  }
}

export async function saveNeighborhoodsDiskBackup(_cityId?: string) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_NEIGHBORHOODS_FILE, JSON.stringify(neighborhoods, null, 2), 'utf8');
    await upsertNeighborhoodsInMySQL(neighborhoods).catch(() => {});
  } catch (e: any) {
    console.warn('[Storage] Warning saving neighborhoods:', e.message);
  }
}

export async function saveLocalCampaignsDiskBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(memoryCampaigns, null, 2), 'utf8');
    await Promise.all(memoryCampaigns.map(c => upsertCampaignInMySQL(c))).catch(() => {});
  } catch (e: any) {
    console.warn('[Storage] Warning saving campaigns:', e.message);
  }
}

export async function saveUsersDiskBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    await Promise.all(users.map(u => upsertUserInMySQL(u))).catch(() => {});
  } catch (e: any) {
    console.warn('[Storage] Warning saving users:', e.message);
  }
}

export function normalizeCampaignKey(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/^camp(?:aign)?[_:-]?/i, '').replace(/^uuid[_:-]?/i, '');
}

export function campaignMatchesId(campaign: Partial<PricingCampaign> | undefined | null, idOrUuid: string | number | null | undefined): boolean {
  if (!campaign || idOrUuid === null || idOrUuid === undefined) return false;
  const target = normalizeCampaignKey(idOrUuid);
  if (!target) return false;

  const ids = new Set<string>([
    normalizeCampaignKey(campaign.id),
    normalizeCampaignKey(campaign.uuid),
    String(campaign.id ?? ''),
    String(campaign.uuid ?? '')
  ].filter(Boolean));

  return [...ids].some(key => key === target || key === `camp_${target}` || key === `campaign_${target}` || key === `uuid_${target}`);
}

export function dedupeCampaigns(campaigns: PricingCampaign[]): PricingCampaign[] {
  const seen = new Map<string, PricingCampaign>();
  const ordered: PricingCampaign[] = [];

  for (const camp of campaigns) {
    const candidateKeys = [
      normalizeCampaignKey(camp.id),
      normalizeCampaignKey(camp.uuid),
      String(camp.id ?? ''),
      String(camp.uuid ?? '')
    ].filter(Boolean);

    const existingMatch = candidateKeys.find(key => seen.has(key));
    if (existingMatch) {
      const prevIndex = ordered.findIndex(item => item === seen.get(existingMatch));
      if (prevIndex >= 0) {
        ordered[prevIndex] = camp;
      }
      continue;
    }

    for (const key of candidateKeys) {
      seen.set(key, camp);
    }
    ordered.push(camp);
  }

  return ordered;
}

// Synchronisation directe depuis MySQL sans injection artificielle
export async function syncFromDatabase() {
  try {
    const [dbUsers, dbCities, dbNbs, dbCampaigns] = await Promise.all([
      fetchUsersFromMySQL(),
      fetchCitiesFromMySQL(),
      fetchNeighborhoodsFromMySQL(),
      fetchCampaignsFromMySQL()
    ]);

    if (dbUsers.length > 0) {
      users = dbUsers;
    } else if (users.length > 0) {
      Promise.all(users.map(u => upsertUserInMySQL(u))).catch(() => {});
    }
    cities = dbCities;
    neighborhoods = dbNbs;
    memoryCampaigns = dedupeCampaigns(dbCampaigns);

    const hist = await fetchHistoryFromMySQL();
    historyRecords = hist;

    console.log(`[MySQL Sync] État synchronisé : ${users.length} utilisateur(s), ${cities.length} ville(s), ${neighborhoods.length} quartier(s), ${memoryCampaigns.length} campagne(s).`);
  } catch (err: any) {
    console.warn('[MySQL Sync Warning]:', err.message);
  }
}

// Alias pour compatibilité ascendante
export const syncFromSupabase = syncFromDatabase;

export async function ensureSynced(): Promise<void> {
  await syncFromDatabase();
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
    id: String(getNextSequence('history')),
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    status: 'success',
    ...record
  };
  historyRecords.unshift(item);
  await insertHistoryInMySQL(record).catch(() => {});
}

export async function deleteHistoryForCampaign(campaignId: string) {
  historyRecords = historyRecords.filter(h =>
    h.metadata?.campaignId !== campaignId &&
    !h.description?.includes(campaignId) &&
    !h.title?.includes(campaignId)
  );
}

export function saveCampaignTripsDiskBackup(_campaignId: string | number, _trips: TripResult[], _canonicalTrips?: CanonicalTrip[]) {}
export function loadCampaignTripsDiskBackup(_campaignId: string | number): TripResult[] | null {
  return null;
}
export function loadCanonicalTripsDiskBackup(_campaignId: string | number): CanonicalTrip[] | null {
  return null;
}
export function deleteCampaignTripsDiskBackup(_campaignId: string | number) {}
export function deleteAllCampaignTripsDiskBackup() {}
