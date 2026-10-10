import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { CanonicalTrip, PricingCampaign, TripResult } from '../types.js';
import { detectArrondissement } from '../../src/utils/routeMatrix.js';
import { neighborhoods } from './memoryStore.js';

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const SHORTAGES_FILE = path.resolve(DATA_DIR, 'campaign_shortages.json');

export interface CampaignShortageRecord {
  id: string | number;
  campaignId: string | number;
  cityName: string;
  cityId?: string | number;
  origin: string;
  destination: string;
  startNeighborhoodId?: string | number;
  endNeighborhoodId?: string | number;
  arrondissementOrigin?: string;
  arrondissementDest?: string;
  timestamp: string;
  timeSlot: string; // e.g. "08:00", "13:00", "18:00"
  distanceKm: number;
  durationMinutes: number;
  waitingMinutes?: number;
  unavailableClasses?: string[];
  jams?: boolean;
  priceYangoEco?: number | null;
  priceHeroEco?: number | null;
}

let memoryShortages: CampaignShortageRecord[] = [];
let isLoaded = false;

function loadFromDisk(): CampaignShortageRecord[] {
  try {
    if (fs.existsSync(SHORTAGES_FILE)) {
      const raw = fs.readFileSync(SHORTAGES_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (e: any) {
    console.warn('[ShortageStore] Warning reading campaign_shortages.json:', e.message);
  }
  return [];
}

function saveToDisk(records: CampaignShortageRecord[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SHORTAGES_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[ShortageStore] Warning writing campaign_shortages.json:', e.message);
  }
}

export function getAllShortages(): CampaignShortageRecord[] {
  if (!isLoaded) {
    memoryShortages = loadFromDisk();
    isLoaded = true;
    if (memoryShortages.length === 0) {
      seedHistoricalShortagesFromTrips();
    }
  }
  return memoryShortages;
}

function resolveArrondissement(neighborhoodName: string): string {
  if (!neighborhoodName) return 'Centre / Général';
  const clean = neighborhoodName.toLowerCase().trim();
  const nb = neighborhoods.find(n => n.name && n.name.toLowerCase().trim() === clean);
  if (nb) {
    return detectArrondissement(nb);
  }
  return 'Centre / Général';
}

function resolveTimeSlot(dateStr?: string, overrideSlot?: string): string {
  if (overrideSlot && overrideSlot !== 'auto') return overrideSlot;
  if (!dateStr) return '13:00';
  try {
    const d = new Date(dateStr);
    const h = d.getHours();
    if (h >= 6 && h < 11) return '08:00';
    if (h >= 11 && h < 16) return '13:00';
    return '18:00';
  } catch {
    return '13:00';
  }
}

/**
 * Extrait et persiste les trajets en pénurie à la fin de la campagne
 * UNIQUEMENT enregistré à la fin de la campagne.
 */
export function extractAndSaveCampaignShortages(
  campaign: PricingCampaign,
  canonicalTrips: CanonicalTrip[],
  fullTrips?: TripResult[]
): CampaignShortageRecord[] {
  const current = getAllShortages();
  const campaignIdStr = String(campaign.id);

  // Supprimer les éventuels doublons pour cette campagne spécifique si re-finalisée
  const filtered = current.filter(s => String(s.campaignId) !== campaignIdStr);

  const fullTripMap = new Map<string, TripResult>();
  if (Array.isArray(fullTrips)) {
    fullTrips.forEach(ft => {
      const key = `${(ft.origin || '').trim()}-${(ft.destination || '').trim()}`;
      fullTripMap.set(key, ft);
    });
  }

  const newRecords: CampaignShortageRecord[] = [];
  const baseTimestamp = campaign.completedAt || campaign.finishedAt || campaign.startedAt || new Date().toISOString();
  const timeSlot = resolveTimeSlot(baseTimestamp, campaign.timeSlotOverride);

  let seq = 1;
  for (const ct of canonicalTrips) {
    const isShortage = Boolean(
      ct.yangoUnavailable ||
      (ct.yangoUnavailableClasses && ct.yangoUnavailableClasses.length > 0) ||
      (ct.yangoWaitingMinutes && ct.yangoWaitingMinutes > 15)
    );

    if (isShortage) {
      const key = `${(ct.origin || '').trim()}-${(ct.destination || '').trim()}`;
      const ft = fullTripMap.get(key);

      const record: CampaignShortageRecord = {
        id: `shortage_${campaignIdStr}_${seq++}`,
        campaignId: campaign.id,
        cityName: campaign.cityName || 'Douala',
        cityId: campaign.cityId || 'city_douala',
        origin: ct.origin || ft?.origin || 'Origine inconnue',
        destination: ct.destination || ft?.destination || 'Destination inconnue',
        startNeighborhoodId: ft?.startNeighborhoodId,
        endNeighborhoodId: ft?.endNeighborhoodId,
        arrondissementOrigin: resolveArrondissement(ct.origin || ft?.origin || ''),
        arrondissementDest: resolveArrondissement(ct.destination || ft?.destination || ''),
        timestamp: ct.createdAt || baseTimestamp,
        timeSlot,
        distanceKm: ct.distanceKm || ft?.distanceKm || 0,
        durationMinutes: ct.durationMin || ft?.durationMinutes || 0,
        waitingMinutes: ct.yangoWaitingMinutes || ft?.yangoWaitingMinutes || 10,
        unavailableClasses: ct.yangoUnavailableClasses || ft?.yangoUnavailableClasses || ['econom'],
        jams: Boolean(ct.jams !== undefined ? ct.jams : ft?.jams),
        priceYangoEco: ct.prices?.yango?.eco || ft?.priceEconom || null,
        priceHeroEco: ct.prices?.heroCab?.eco || ft?.priceHero || null
      };

      newRecords.push(record);
    }
  }

  memoryShortages = [...newRecords, ...filtered];
  saveToDisk(memoryShortages);

  console.log(`[ShortageStore] ${newRecords.length} trajets en pénurie extraits et stockés pour la campagne ${campaign.id} (${campaign.cityName}).`);
  return newRecords;
}

/**
 * Extraction rétroactive depuis les campagnes existantes dans server/data/trips.json
 */
export function seedHistoricalShortagesFromTrips(): number {
  try {
    const TRIPS_FILE = path.resolve(DATA_DIR, 'trips.json');
    const CAMPAIGNS_FILE = path.resolve(DATA_DIR, 'campaigns.json');

    if (!fs.existsSync(TRIPS_FILE) || !fs.existsSync(CAMPAIGNS_FILE)) return 0;

    const tripsStore: Record<string, any> = JSON.parse(fs.readFileSync(TRIPS_FILE, 'utf8'));
    const campaigns: PricingCampaign[] = JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf8'));

    const extracted: CampaignShortageRecord[] = [];
    let globalSeq = 1;

    for (const camp of campaigns) {
      const campIdStr = String(camp.id);
      const entry = tripsStore[campIdStr] || (camp.uuid ? tripsStore[camp.uuid] : null);
      if (!entry) continue;

      let tripsList: any[] = [];
      if (Array.isArray(entry)) {
        tripsList = entry;
      } else if (entry && Array.isArray(entry.trips)) {
        tripsList = entry.trips;
      } else if (entry && Array.isArray(entry.canonicalTrips)) {
        tripsList = entry.canonicalTrips;
      }

      const baseTimestamp = camp.completedAt || camp.finishedAt || camp.startedAt || '2026-02-15T12:00:00Z';
      const slot = resolveTimeSlot(baseTimestamp, camp.timeSlotOverride);

      for (const t of tripsList) {
        const isShortage = Boolean(t.yangoUnavailable || (t.yangoUnavailableClasses && t.yangoUnavailableClasses.length > 0));
        if (isShortage) {
          const originName = t.origin || t.startNeighborhoodName || 'Origine';
          const destName = t.destination || t.endNeighborhoodName || 'Destination';

          extracted.push({
            id: `shortage_seed_${globalSeq++}`,
            campaignId: camp.id,
            cityName: camp.cityName || 'Douala',
            cityId: camp.cityId || 'city_douala',
            origin: originName,
            destination: destName,
            startNeighborhoodId: t.startNeighborhoodId,
            endNeighborhoodId: t.endNeighborhoodId,
            arrondissementOrigin: resolveArrondissement(originName),
            arrondissementDest: resolveArrondissement(destName),
            timestamp: t.createdAt || baseTimestamp,
            timeSlot: slot,
            distanceKm: t.distanceKm || t.km || 5.2,
            durationMinutes: t.durationMinutes || t.durationMin || 14,
            waitingMinutes: t.yangoWaitingMinutes || 12,
            unavailableClasses: t.yangoUnavailableClasses || ['econom'],
            jams: Boolean(t.jams),
            priceYangoEco: t.priceEconom || t.price || t.prices?.yango?.eco || 1400,
            priceHeroEco: t.priceHero || t.prices?.heroCab?.eco || 950
          });
        }
      }
    }

    if (extracted.length > 0) {
      memoryShortages = extracted;
      saveToDisk(memoryShortages);
      console.log(`[ShortageStore] ${extracted.length} trajets historiques en pénurie extraits avec succès.`);
      return extracted.length;
    }
  } catch (err: any) {
    console.warn('[ShortageStore] Error during historical shortages seed:', err?.message);
  }
  return 0;
}

/**
 * Calcul analytique des statistiques de pénurie
 */
export function computeShortagesAnalytics(cityIdFilter?: string) {
  const all = getAllShortages();
  const target = (cityIdFilter && cityIdFilter !== 'all')
    ? all.filter(s => String(s.cityId) === String(cityIdFilter))
    : all;

  const originMap: Record<string, number> = {};
  const destMap: Record<string, number> = {};
  const corridorMap: Record<string, { origin: string; destination: string; count: number; sumDist: number }> = {};
  const slotMap: Record<string, number> = { '08:00': 0, '13:00': 0, '18:00': 0 };
  const arrMap: Record<string, number> = {};

  for (const s of target) {
    // Origine
    originMap[s.origin] = (originMap[s.origin] || 0) + 1;
    // Destination
    destMap[s.destination] = (destMap[s.destination] || 0) + 1;
    // Corridor OD
    const cKey = `${s.origin} ➔ ${s.destination}`;
    if (!corridorMap[cKey]) {
      corridorMap[cKey] = { origin: s.origin, destination: s.destination, count: 0, sumDist: 0 };
    }
    corridorMap[cKey].count++;
    corridorMap[cKey].sumDist += s.distanceKm || 0;

    // Créneau horaire
    const slot = s.timeSlot || '13:00';
    slotMap[slot] = (slotMap[slot] || 0) + 1;

    // Arrondissement d'origine
    const arr = s.arrondissementOrigin || 'Centre / Général';
    arrMap[arr] = (arrMap[arr] || 0) + 1;
  }

  const total = target.length;

  const topOrigins = Object.entries(originMap)
    .map(([name, count]) => ({ name, count, pct: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topDestinations = Object.entries(destMap)
    .map(([name, count]) => ({ name, count, pct: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topCorridors = Object.values(corridorMap)
    .map(c => ({
      origin: c.origin,
      destination: c.destination,
      count: c.count,
      avgDistanceKm: c.count > 0 ? Number((c.sumDist / c.count).toFixed(1)) : 0,
      pct: total > 0 ? Number(((c.count / total) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const byTimeSlot = Object.entries(slotMap).map(([slot, count]) => ({
    slot,
    label: slot === '08:00' ? 'Matin (08:00)' : slot === '13:00' ? 'Midi (13:00)' : 'Soirée (18:00)',
    count,
    pct: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
  }));

  const byArrondissement = Object.entries(arrMap)
    .map(([name, count]) => ({ name, count, pct: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.count - a.count);

  return {
    totalShortages: total,
    topOrigins,
    topDestinations,
    topCorridors,
    byTimeSlot,
    byArrondissement
  };
}

export function deleteShortageRecord(id: string | number): boolean {
  const current = getAllShortages();
  const filtered = current.filter(s => String(s.id) !== String(id));
  if (filtered.length !== current.length) {
    memoryShortages = filtered;
    saveToDisk(memoryShortages);
    return true;
  }
  return false;
}

export function clearAllShortages(): void {
  memoryShortages = [];
  saveToDisk(memoryShortages);
}
