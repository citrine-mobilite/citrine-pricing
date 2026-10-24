import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { City, Neighborhood, PricingCampaign, TripResult, CanonicalTrip } from '../types.js';
import {
  saveCanonicalCampaignBatch,
  saveCanonicalCampaignResults,
  loadCanonicalCampaignResults,
  saveCampaignToSupabase
} from '../db/supabase.js';
// Disk and Supabase persistence only
import {
  activePricingSessions,
  memoryCampaigns,
  memoryCampaignTrips,
  memoryCampaignCanonicalTrips,
  neighborhoods,
  cities,
  recordHistory,
  ensureSynced,
  saveCampaignTripsDiskBackup,
  loadCampaignTripsDiskBackup,
  saveLocalCampaignsDiskBackup
} from '../db/memoryStore.js';
import { callYangoRoutestats, calculateDistanceKm } from './yangoService.js';
import { callHeroStats } from './heroService.js';
import { callTripMasterStats } from './tripMasterService.js';
import { generateBenchmarkPairs, detectArrondissement } from '../../src/utils/routeMatrix.js';
import { getNextSequence } from '../db/counters.js';

export function cleanNeighborhoodName(name: string | null | undefined): string {
  if (!name) return '—';
  return name.replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim();
}

export interface ChunkDefinition {
  chunkIndex: number;
  totalChunks: number;
  pairs: Array<{ origin: Neighborhood; dest: Neighborhood }>;
}

export interface CampaignSessionState {
  campaign: PricingCampaign;
  city: City;
  chunks: ChunkDefinition[];
  canonicalTrips: CanonicalTrip[];
  trips: TripResult[];
  completedPairs: number;
  successfulPairs?: number;
  failedPairs: number;
  completedBatches: number;
  startedAtMs: number;
}

// Map local des sessions actives
export const campaignSessions = new Map<string, CampaignSessionState>();

function fetchWithTimeout<T>(promise: Promise<T>, ms = 10000, fallback: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export const cancelledCampaignIds = new Set<string>();

export function cancelChunkCampaignSession(campaignId: string): boolean {
  const strId = String(campaignId);
  cancelledCampaignIds.add(strId);

  const memCamp = memoryCampaigns.find(c => String(c.id) === strId || c.uuid === strId);
  const campUuid = memCamp?.uuid || strId;
  cancelledCampaignIds.add(campUuid);

  const session = campaignSessions.get(campUuid) || campaignSessions.get(strId);
  if (session) {
    session.campaign.status = 'cancelled';
  }
  if (memCamp) {
    memCamp.status = 'cancelled';
  }

  campaignSessions.delete(campUuid);
  campaignSessions.delete(strId);

  return true;
}

/**
 * 1. Initialisation d'une session de campagne pour le Client-Driven Chunking
 */
export async function initializeCampaignSession(
  campaign: PricingCampaign,
  city: City,
  pairs: Array<{ origin: Neighborhood; dest: Neighborhood }>
): Promise<{ totalChunks: number; totalPairs: number }> {
  const LOT_SIZE = 10;
  const chunks: ChunkDefinition[] = [];

  for (let i = 0; i < pairs.length; i += LOT_SIZE) {
    chunks.push({
      chunkIndex: Math.floor(i / LOT_SIZE) + 1,
      totalChunks: Math.ceil(pairs.length / LOT_SIZE),
      pairs: pairs.slice(i, i + LOT_SIZE)
    });
  }

  campaign.totalBatches = chunks.length;
  campaign.workersCount = 1;
  campaign.status = 'in_progress';

  const sessionState: CampaignSessionState = {
    campaign,
    city,
    chunks,
    canonicalTrips: [],
    trips: [],
    completedPairs: 0,
    failedPairs: 0,
    completedBatches: 0,
    startedAtMs: Date.now()
  };

  const campUuid = campaign.uuid || String(campaign.id);
  campaignSessions.set(campUuid, sessionState);
  campaignSessions.set(String(campaign.id), sessionState);

  // Mémoire et persistance locale
  saveLocalCampaignsDiskBackup();
  memoryCampaigns.unshift(campaign);
  memoryCampaignTrips[campUuid] = sessionState.trips;
  memoryCampaignCanonicalTrips[campUuid] = sessionState.canonicalTrips;

  return { totalChunks: chunks.length, totalPairs: pairs.length };
}

/**
 * 2. Traitement à la demande d'un lot individuel (Client-Driven Chunking)
 */
export async function processCampaignChunk(
  campaignId: string, 
  chunkIndex: number,
  fallbackMeta?: {
    cityId?: string;
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
  chunkCanonicalTrips?: CanonicalTrip[];
}> {
  let session = campaignSessions.get(campaignId);

  // Reconstitution si le serveur a redémarré (cold start Serverless ou instance Cloud Run secondaire)
  if (!session) {
    await ensureSynced();
    let camp = memoryCampaigns.find(c => c.id === campaignId);

    // Si la campagne n'est toujours pas trouvée, la reconstruire à partir des métadonnées du client
    if (!camp) {
      const cId = fallbackMeta?.cityId || 'city_douala';
      const cName = fallbackMeta?.cityName || 'Douala';
      const curr = fallbackMeta?.currency || 'XAF';
      camp = {
        id: campaignId,
        cityId: cId,
        cityName: cName,
        currency: curr,
        triggerType: 'manual',
        status: 'in_progress',
        totalPairs: 0,
        completedPairs: 0,
        failedPairs: 0,
        startedAt: new Date().toISOString(),
        scopeMode: (fallbackMeta?.scopeMode as any) || 'global',
        arrondissement: fallbackMeta?.arrondissement,
        originArrondissement: fallbackMeta?.originArrondissement,
        destArrondissement: fallbackMeta?.destArrondissement,
        sampleLimit: fallbackMeta?.sampleLimit
      } as PricingCampaign;
      memoryCampaigns.unshift(camp);
    }

    const city = cities.find(c => c.id === camp?.cityId) || { id: camp.cityId, name: camp.cityName, currency: camp.currency } as City;
    const activeNbs = neighborhoods.filter(n => n.cityId === city.id && n.active);
    let pairs = generateBenchmarkPairs(activeNbs);
    const limitNum = typeof camp.sampleLimit === 'number' ? camp.sampleLimit : (camp.sampleLimit && String(camp.sampleLimit) !== 'all' ? parseInt(String(camp.sampleLimit), 10) : undefined);
    if (limitNum && limitNum < pairs.length) {
      pairs = pairs.slice(0, limitNum);
    }

    const LOT_SIZE = 10;
    const chunks: ChunkDefinition[] = [];
    for (let i = 0; i < pairs.length; i += LOT_SIZE) {
      chunks.push({
        chunkIndex: Math.floor(i / LOT_SIZE) + 1,
        totalChunks: Math.ceil(pairs.length / LOT_SIZE),
        pairs: pairs.slice(i, i + LOT_SIZE)
      });
    }

    if (camp.status !== 'cancelled') {
      camp.status = 'in_progress';
    }
    camp.totalPairs = pairs.length;
    camp.totalBatches = chunks.length;

    const diskTrips = loadCampaignTripsDiskBackup(campaignId) || [];
    let diskCanonical = memoryCampaignCanonicalTrips[campaignId] || [];
    if (diskCanonical.length === 0) {
      try {
        const TRIPS_DIR = path.resolve(process.cwd(), 'server/data/trips');
        const canonPath = path.resolve(TRIPS_DIR, `canonical_${campaignId}.json`);
        if (fs.existsSync(canonPath)) {
          diskCanonical = JSON.parse(fs.readFileSync(canonPath, 'utf8'));
        }
      } catch {}
    }

    session = {
      campaign: camp,
      city,
      chunks,
      canonicalTrips: diskCanonical,
      trips: diskTrips,
      completedPairs: Math.max(camp.completedPairs || 0, diskCanonical.length),
      failedPairs: camp.failedPairs || 0,
      completedBatches: Math.max(camp.completedBatches || 0, Math.floor(diskCanonical.length / 20)),
      startedAtMs: new Date(camp.startedAt).getTime() || Date.now()
    };
    campaignSessions.set(campaignId, session);
  }

  const memCamp = memoryCampaigns.find(c => c.id === campaignId);
  const targetChunk = session.chunks.find(c => c.chunkIndex === chunkIndex);
  if (!targetChunk || session.campaign.status === 'cancelled' || memCamp?.status === 'cancelled') {
    if (session) session.campaign.status = 'cancelled';
    if (memCamp) memCamp.status = 'cancelled';
    return {
      success: false,
      chunkIndex,
      completedPairs: session ? session.completedPairs : (memCamp?.completedPairs || 0),
      campaign: session ? session.campaign : memCamp!,
      chunkTrips: []
    };
  }

  const chunkTrips: TripResult[] = [];
  const chunkCanonicalTrips: CanonicalTrip[] = [];

  const emptyStats = { price: null, priceEconom: null, priceConfort: null, priceStandard: null, priceEco: null };

  await Promise.all(targetChunk.pairs.map(async (pair) => {
    if (session.campaign.status === 'cancelled' || memCamp?.status === 'cancelled') {
      return;
    }
    const { origin, dest } = pair;
    const distKm = calculateDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng);
    const durationMin = Math.max(2, Math.round((distKm / 25) * 60));

    try {
      const [yangoStats, heroStats, tmStats] = await Promise.all([
        fetchWithTimeout(callYangoRoutestats(origin.lat, origin.lng, dest.lat, dest.lng, 'econom', session.city.currency), 10000, emptyStats as any),
        fetchWithTimeout(callHeroStats(origin.lat, origin.lng, dest.lat, dest.lng, 'econom', session.city.currency, origin.name, dest.name), 10000, emptyStats as any),
        fetchWithTimeout(callTripMasterStats(origin.lat, origin.lng, dest.lat, dest.lng, session.city.currency, origin.name, dest.name), 10000, emptyStats as any)
      ]);

      const yEco = yangoStats.priceEconom || (yangoStats.classes?.econom?.price) || yangoStats.price || null;
      const yConf = yangoStats.priceConfort || yangoStats.classes?.business?.price || yangoStats.classes?.comfort?.price || null;
      const yConfPlus = yangoStats.priceConfortPlus || yangoStats.classes?.comfortplus?.price || null;
      const yMoto = yangoStats.priceMoto || yangoStats.classes?.moto?.price || null;

      const hEco = heroStats.priceStandard || heroStats.price || null;
      const hConf = heroStats.priceConfort || null;
      const hSuv = heroStats.priceSuv || null;
      const hPerKm = heroStats.pricePerKm || null;

      const tmEco = tmStats.priceEco || null;
      const tmConf = tmStats.priceConfort || null;
      const tmMoto = tmStats.priceMoto || null;

      const ecoCandidates = [
        { name: 'yango', p: yEco },
        { name: 'hero', p: hEco },
        { name: 'tripmaster', p: tmEco }
      ].filter(c => c.p && c.p > 0);
      ecoCandidates.sort((a, b) => (a.p as number) - (b.p as number));

      const cheaperEco = ecoCandidates[0]?.name || null;
      const deltaEco = ecoCandidates.length > 1 ? (ecoCandidates[1].p as number) - (ecoCandidates[0].p as number) : 0;

      const confCandidates = [
        { name: 'yango', p: yConf },
        { name: 'hero', p: hConf },
        { name: 'tripmaster', p: tmConf }
      ].filter(c => c.p && c.p > 0);
      confCandidates.sort((a, b) => (a.p as number) - (b.p as number));
      const cheaperConf = confCandidates[0]?.name || null;

      const tripUuid = randomUUID();
      const tripId = getNextSequence('trips');
      const cleanOrigin = cleanNeighborhoodName(origin.name);
      const cleanDest = cleanNeighborhoodName(dest.name);

      const tripDistanceKm = (yangoStats.distanceKm && yangoStats.distanceKm > 0) ? yangoStats.distanceKm : distKm;
      const tripDurationMin = (yangoStats.durationMinutes && yangoStats.durationMinutes > 0) ? yangoStats.durationMinutes : durationMin;

      const canonicalTrip: CanonicalTrip = {
        id: String(tripId),
        uuid: tripUuid,
        origin: cleanOrigin,
        destination: cleanDest,
        distanceKm: tripDistanceKm,
        durationMin: tripDurationMin,
        jams: Boolean(yangoStats.jams),
        yangoUnavailable: Boolean(yangoStats.yangoUnavailable),
        yangoWaitingMinutes: yangoStats.yangoWaitingMinutes,
        yangoUnavailableClasses: yangoStats.yangoUnavailableClasses,
        prices: {
          yango: { 
            eco: yEco, 
            confort: yConf, 
            confortPlus: yConfPlus, 
            moto: yMoto,
            jams: Boolean(yangoStats.jams),
            yangoUnavailable: Boolean(yangoStats.yangoUnavailable)
          },
          heroCab: { eco: hEco, confort: hConf, suv: hSuv, perKm: hPerKm },
          tripMaster: { eco: tmEco, confort: tmConf, moto: tmMoto }
        },
        cheapest: {
          eco: cheaperEco,
          confort: cheaperConf,
          overall: cheaperEco
        },
        status: (yEco || hEco || tmEco) ? 'success' : 'failed',
        createdAt: new Date().toISOString()
      };

      const tripRow: TripResult = {
        id: String(tripId),
        uuid: tripUuid,
        campaignId: session.campaign.uuid || campaignId,
        origin: cleanOrigin,
        destination: cleanDest,
        distanceKm: tripDistanceKm,
        durationMinutes: tripDurationMin,
        jams: Boolean(yangoStats.jams),
        yangoUnavailable: Boolean(yangoStats.yangoUnavailable),
        yangoWaitingMinutes: yangoStats.yangoWaitingMinutes,
        yangoUnavailableClasses: yangoStats.yangoUnavailableClasses,
        prices: {
          yango: { 
            eco: yEco, 
            confort: yConf, 
            confortPlus: yConfPlus, 
            moto: yMoto,
            jams: Boolean(yangoStats.jams),
            yangoUnavailable: Boolean(yangoStats.yangoUnavailable)
          },
          heroCab: { eco: hEco, confort: hConf, suv: hSuv, perKm: hPerKm },
          tripMaster: { eco: tmEco, confort: tmConf, moto: tmMoto }
        },
        cheapest: {
          eco: cheaperEco,
          confort: cheaperConf,
          overall: cheaperEco
        },
        status: (yEco || hEco || tmEco) ? 'success' : 'failed',
        createdAt: new Date().toISOString()
      };

      if (yangoStats.jams) {
        session.campaign.hasJamsCount = (session.campaign.hasJamsCount || 0) + 1;
      }
      if (yangoStats.yangoUnavailable) {
        session.campaign.yangoShortageCount = (session.campaign.yangoShortageCount || 0) + 1;
      }

      chunkCanonicalTrips.push(canonicalTrip);
      chunkTrips.push(tripRow);
      session.canonicalTrips.push(canonicalTrip);
      session.trips.push(tripRow);

      if (yEco || hEco || tmEco) {
        session.successfulPairs = (session.successfulPairs || 0) + 1;
      } else {
        session.failedPairs++;
      }
      session.completedPairs++;
    } catch {
      session.failedPairs++;
      session.completedPairs++;
    }
  }));

  const previousChunksPairs = session.chunks
    .filter(c => c.chunkIndex < chunkIndex)
    .reduce((sum, c) => sum + c.pairs.length, 0);

  session.completedPairs = previousChunksPairs + targetChunk.pairs.length;
  session.completedBatches = chunkIndex;
  session.campaign.completedPairs = session.completedPairs;
  session.campaign.failedPairs = session.failedPairs;
  session.campaign.completedBatches = session.completedBatches;
  session.campaign.durationSeconds = Math.max(1, Math.round((Date.now() - session.startedAtMs) / 1000));

  // Enregistrement par lot en arrière-plan non bloquant (ne retarde pas la réponse au client)
  if (chunkCanonicalTrips.length > 0) {
    saveCanonicalCampaignBatch(campaignId, chunkIndex, chunkCanonicalTrips, session.city.name).catch((err) => {
      console.warn(`[Supabase/Disk] Background batch error on chunk ${chunkIndex}:`, err.message);
    });
  }

  // Synchro mémoire & persistance disque asynchrone non-bloquante
  memoryCampaignTrips[campaignId] = session.trips;
  memoryCampaignCanonicalTrips[campaignId] = session.canonicalTrips;
  setImmediate(() => {
    try {
      saveCampaignTripsDiskBackup(campaignId, session.trips, session.canonicalTrips);
      saveLocalCampaignsDiskBackup();
    } catch {}
  });

  return {
    success: true,
    chunkIndex,
    completedPairs: session.completedPairs,
    campaign: session.campaign,
    chunkTrips,
    chunkCanonicalTrips
  };
}

/**
 * 3. Finalisation globale de la campagne
 */
export async function finalizeCampaignExecution(
  campaignId: string,
  clientCanonicalTrips?: CanonicalTrip[],
  clientTrips?: TripResult[]
): Promise<PricingCampaign> {
  const strId = String(campaignId);
  if (cancelledCampaignIds.has(strId)) {
    console.log(`[Pricing] Campagne #${strId} supprimée ou annulée. Finalisation ignorée.`);
    throw new Error('Campagne annulée ou supprimée');
  }
  const session = campaignSessions.get(strId) || campaignSessions.get(campaignId);
  if (session && session.campaign.status === 'cancelled') {
    console.log(`[Pricing] Session de campagne #${strId} marquée comme annulée. Finalisation ignorée.`);
    throw new Error('Campagne annulée');
  }
  const rawCampaign = session ? session.campaign : memoryCampaigns.find(c => String(c.id) === strId || c.uuid === strId);
  let campaign: PricingCampaign;

  if (!rawCampaign) {
    if (clientCanonicalTrips && clientCanonicalTrips.length > 0) {
      campaign = {
        id: campaignId,
        cityName: 'Douala',
        cityId: 'city_douala',
        currency: 'XAF',
        status: 'completed',
        totalPairs: clientCanonicalTrips.length,
        completedPairs: clientCanonicalTrips.length,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString()
      } as PricingCampaign;
      memoryCampaigns.unshift(campaign);
    } else {
      throw new Error(`Campagne ${campaignId} introuvable pour finalisation.`);
    }
  } else {
    campaign = rawCampaign;
  }

  let canonicalTrips = session ? session.canonicalTrips : memoryCampaignCanonicalTrips[campaignId] || [];
  if (canonicalTrips.length === 0) {
    try {
      canonicalTrips = await loadCanonicalCampaignResults(campaignId);
    } catch {}
  }

  // Fusion infaillible avec les trajets collectés par le client (évite toute perte entre conteneurs Serverless Cloud Run)
  if (Array.isArray(clientCanonicalTrips) && clientCanonicalTrips.length > 0) {
    const tripMap = new Map<string, CanonicalTrip>();
    for (const t of canonicalTrips) {
      tripMap.set(String(t.id || `${t.origin}-${t.destination}`), t);
    }
    for (const ct of clientCanonicalTrips) {
      tripMap.set(String(ct.id || `${ct.origin}-${ct.destination}`), ct);
    }
    canonicalTrips = Array.from(tripMap.values());
  }

  if (Array.isArray(clientTrips) && clientTrips.length > 0 && session) {
    const rMap = new Map<string, TripResult>();
    for (const t of session.trips) {
      rMap.set(t.id || `${t.origin}-${t.destination}`, t);
    }
    for (const ct of clientTrips) {
      rMap.set(ct.id || `${ct.origin}-${ct.destination}`, ct);
    }
    session.trips = Array.from(rMap.values());
  }

  let sumYangoEco = 0;
  let countYango = 0;
  let sumHeroEco = 0;
  let countHero = 0;
  let sumTmEco = 0;
  let countTm = 0;
  let sumDist = 0;

  let yangoCheaper = 0;
  let heroCheaper = 0;
  let equalCount = 0;
  let totalDelta = 0;

  for (const t of canonicalTrips) {
    sumDist += t.distanceKm;
    const y = t.prices.yango.eco;
    const h = t.prices.heroCab.eco;
    const tm = t.prices.tripMaster.eco;

    if (y && y > 0) { sumYangoEco += y; countYango++; }
    if (h && h > 0) { sumHeroEco += h; countHero++; }
    if (tm && tm > 0) { sumTmEco += tm; countTm++; }

    if (t.cheapest.eco === 'yango') yangoCheaper++;
    else if (t.cheapest.eco === 'hero') heroCheaper++;
    else equalCount++;

    if (y && h) {
      totalDelta += Math.abs(y - h);
    }
  }

  const completed = canonicalTrips.length;
  campaign.completedPairs = completed;
  if (campaign.status !== 'cancelled') {
    campaign.status = 'completed';
  }
  campaign.finishedAt = new Date().toISOString();
  campaign.completedAt = campaign.finishedAt;
  campaign.durationSeconds = Math.max(1, Math.round((new Date(campaign.finishedAt).getTime() - new Date(campaign.startedAt).getTime()) / 1000));

  campaign.avgDistanceKm = completed > 0 ? Number((sumDist / completed).toFixed(2)) : 0;
  campaign.avgPrice = countYango > 0 ? Math.round(sumYangoEco / countYango) : 0;
  campaign.avgPricePerKm = campaign.avgDistanceKm > 0 ? Math.round(campaign.avgPrice / campaign.avgDistanceKm) : 0;

  campaign.heroStats = {
    avgPrice: countHero > 0 ? Math.round(sumHeroEco / countHero) : 0,
    minPrice: 0,
    maxPrice: 0,
    avgDriversCount: 0,
    avgClosestDriverDistanceKm: 0,
    count: countHero
  } as any;

  campaign.tripMasterStats = {
    avgPrice: countTm > 0 ? Math.round(sumTmEco / countTm) : 0,
    minPrice: 0,
    maxPrice: 0,
    count: countTm
  } as any;

  campaign.deltaStats = {
    yangoCheaperCount: yangoCheaper,
    heroCheaperCount: heroCheaper,
    equalCount,
    avgDeltaFcfa: completed > 0 ? Math.round(totalDelta / completed) : 0
  };

  // Répartition statistique dynamique par arrondissement (pour filtres analytiques instantanés)
  const arrMap: Record<string, { sumY: number; countY: number; sumH: number; countH: number; sumT: number; countT: number; count: number }> = {};
  const nbMap = new Map<string, string>();
  for (const nb of neighborhoods) {
    if (nb.name) {
      nbMap.set(nb.name.toLowerCase().trim(), detectArrondissement(nb));
    }
  }

  for (const t of canonicalTrips) {
    const oArr = nbMap.get((t.origin || '').toLowerCase().trim());
    const dArr = nbMap.get((t.destination || '').toLowerCase().trim());
    const targets = new Set<string>();
    if (oArr) targets.add(oArr);
    if (dArr) targets.add(dArr);

    for (const arr of targets) {
      if (!arrMap[arr]) {
        arrMap[arr] = { sumY: 0, countY: 0, sumH: 0, countH: 0, sumT: 0, countT: 0, count: 0 };
      }
      arrMap[arr].count++;
      const y = t.prices?.yango?.eco;
      const h = t.prices?.heroCab?.eco;
      const tm = t.prices?.tripMaster?.eco;
      if (y && y > 0) { arrMap[arr].sumY += y; arrMap[arr].countY++; }
      if (h && h > 0) { arrMap[arr].sumH += h; arrMap[arr].countH++; }
      if (tm && tm > 0) { arrMap[arr].sumT += tm; arrMap[arr].countT++; }
    }
  }

  campaign.arrondissementStats = {};
  for (const [arrName, d] of Object.entries(arrMap)) {
    campaign.arrondissementStats[arrName] = {
      arrondissement: arrName,
      avgPrice: d.countY > 0 ? Math.round(d.sumY / d.countY) : 0,
      heroAvgPrice: d.countH > 0 ? Math.round(d.sumH / d.countH) : 0,
      tripMasterAvgPrice: d.countT > 0 ? Math.round(d.sumT / d.countT) : 0,
      count: d.count
    };
  }

  campaign.canonicalTripsCount = canonicalTrips.length;
  const campaignUuid = campaign.uuid || campaignId;

  if (canonicalTrips && canonicalTrips.length > 0) {
    await saveCanonicalCampaignResults(campaignUuid, canonicalTrips, campaign.cityName);
  }

  const existingIdx = memoryCampaigns.findIndex(c => c.uuid === campaignUuid || String(c.id) === String(campaign.id));
  if (existingIdx >= 0) {
    memoryCampaigns[existingIdx] = campaign;
  } else {
    memoryCampaigns.unshift(campaign);
  }

  // Cache mémoire RAM serveur immédiat
  if (session?.trips && session.trips.length > 0) {
    memoryCampaignTrips[campaignUuid] = session.trips;
  }
  if (canonicalTrips && canonicalTrips.length > 0) {
    memoryCampaignCanonicalTrips[campaignUuid] = canonicalTrips;
  }
  saveCampaignTripsDiskBackup(campaignUuid, memoryCampaignTrips[campaignUuid] || [], canonicalTrips);
  saveLocalCampaignsDiskBackup();
  
  // Persistance sur le disque et Supabase
  await saveCampaignToSupabase(campaign);

  campaignSessions.delete(campaignUuid);
  campaignSessions.delete(String(campaign.id));

  await recordHistory({
    action: 'complete_campaign',
    eventType: 'campaign',
    title: `Campagne ${campaign.cityName} terminée`,
    description: `${completed} trajets tarifés en ${campaign.durationSeconds}s. Format JSON canonique stocké en BD.`
  });

  return campaign;
}

/**
 * Rétro-compatibilité
 */
export async function startCampaignExecution(
  campaign: PricingCampaign,
  city: City,
  pairs: Array<{ origin: Neighborhood; dest: Neighborhood }>,
  isTestSample: boolean = false
) {
  return await initializeCampaignSession(campaign, city, pairs);
}

/**
 * Exécution automatique complète en arrière-plan d'une campagne (appelée par pg_cron / webhooks)
 */
export async function runAutomatedServerCampaign(
  targetCityId?: string | number,
  triggeredByName: string = 'Cron Supabase (pg_cron)'
): Promise<{ campaignId: number; totalPairs: number }> {
  await ensureSynced();

  const city = cities.find(c => 
    targetCityId 
      ? (String(c.id) === String(targetCityId) || c.uuid === targetCityId)
      : c.active
  ) || cities[0];

  if (!city || !city.active) {
    throw new Error(`Aucune ville active trouvée pour exécuter le pricing automatique.`);
  }

  const activeNbs = neighborhoods.filter(n => (String(n.cityId) === String(city.id) || n.cityId === city.uuid) && n.active);
  if (activeNbs.length < 2) {
    throw new Error(`Moins de 2 quartiers actifs pour ${city.name}.`);
  }

  const pairs = generateBenchmarkPairs(activeNbs);
  const campaignSeqId = getNextSequence('campaigns');
  const campaignUuid = randomUUID();

  const campaign: PricingCampaign = {
    id: campaignSeqId,
    uuid: campaignUuid,
    cityId: String(city.id),
    cityName: city.name,
    currency: city.currency || 'XAF',
    triggerType: 'scheduled',
    triggeredByUserId: 'cron_supabase',
    triggeredByUserName: triggeredByName,
    triggeredByUserRole: 'system',
    status: 'in_progress',
    totalPairs: pairs.length,
    completedPairs: 0,
    failedPairs: 0,
    startedAt: new Date().toISOString(),
    logs: [
      {
        level: 'info',
        timestamp: new Date().toISOString(),
        message: `Démarrage de la tarification automatique (${pairs.length} trajets) programmée par ${triggeredByName} pour ${city.name}.`
      }
    ]
  };

  const { totalChunks } = await initializeCampaignSession(campaign, city, pairs);

  // Exécution asynchrone lot par lot sans bloquer la requête HTTP
  (async () => {
    try {
      console.log(`[Cron Pricing] Démarrage de la campagne #${campaignSeqId} (${pairs.length} trajets, ${totalChunks} lots - 3 workers parallèles)`);
      const CONCURRENCY = 3;
      const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i + 1);
      let nextIdx = 0;

      const runWorker = async () => {
        while (nextIdx < chunkIndices.length) {
          if (cancelledCampaignIds.has(String(campaignSeqId)) || cancelledCampaignIds.has(campaignUuid)) {
            console.log(`[Cron Pricing] Campagne #${campaignSeqId} supprimée/annulée en cours de route. Arrêt immédiat.`);
            return;
          }
          const chunkIdx = chunkIndices[nextIdx++];
          const session = campaignSessions.get(campaignUuid) || campaignSessions.get(String(campaignSeqId));
          if (!session || session.campaign.status === 'cancelled') {
            console.log(`[Cron Pricing] Campagne #${campaignSeqId} interrompue.`);
            return;
          }
          await processCampaignChunk(String(campaignSeqId), chunkIdx);
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, totalChunks) }, () => runWorker()));

      if (cancelledCampaignIds.has(String(campaignSeqId)) || cancelledCampaignIds.has(campaignUuid)) {
        return;
      }

      await finalizeCampaignExecution(String(campaignSeqId));
      console.log(`[Cron Pricing] Campagne #${campaignSeqId} terminée et enregistrée avec succès dans Supabase.`);
    } catch (err: any) {
      if (!cancelledCampaignIds.has(String(campaignSeqId))) {
        console.error(`[Cron Pricing] Erreur lors de l'exécution automatique #${campaignSeqId}:`, err.message);
      }
    }
  })();

  return { campaignId: campaignSeqId, totalPairs: pairs.length };
}

/**
 * Exécution automatique complète en arrière-plan d'une campagne aéroport (appelée par pg_cron à 22h)
 */
export async function runAutomatedAirportCampaign(
  targetCityId?: string | number,
  triggeredByName: string = 'Cron Aéroport (pg_cron)'
): Promise<{ campaignId: number; totalPairs: number }> {
  await ensureSynced();

  const city = cities.find(c => 
    targetCityId 
      ? (String(c.id) === String(targetCityId) || c.uuid === targetCityId)
      : c.active
  ) || cities[0];

  if (!city || !city.active) {
    throw new Error(`Aucune ville active trouvée pour exécuter le pricing aéroport.`);
  }

  const cId = String(city.id);
  const cUuid = city.uuid || '';
  const cName = city.name.toLowerCase().trim();

  const cityNbs = neighborhoods.filter(n => {
    if (!n.active) return false;
    if (String(n.cityId) === cId || (cUuid && n.cityId === cUuid)) return true;
    if (cName && (n.ville || (n as any).cityName || '').toLowerCase().trim() === cName) return true;
    return false;
  });
  
  // Identifier le quartier aéroport (zoneType === 'airport' ou nom contenant 'aéroport')
  const airportNb = cityNbs.find(n => 
    n.zoneType === 'airport' || 
    n.zone === 'airport' || 
    n.name.toLowerCase().includes('aéroport') ||
    n.name.toLowerCase().includes('aeroport')
  );

  if (!airportNb && !city.airport) {
    throw new Error(`Aucun quartier ou configuration aéroport trouvée pour ${city.name}.`);
  }

  // Trajets vers l'aéroport (Sens unique : Quartier -> Aéroport)
  // Si la ville a N quartiers, il y a exactement les N trajets de chaque quartier vers l'aéroport
  const pairs: Array<{ origin: Neighborhood; dest: Neighborhood }> = [];
  const airportNode: Neighborhood = {
    id: airportNb?.id || 'airport_dest_node',
    uuid: airportNb?.uuid || 'uuid_airport_dest',
    cityId: city.uuid || String(city.id),
    name: airportNb?.name || city.airport?.name || `Aéroport International de ${city.name}`,
    lat: airportNb?.lat || city.airport?.lat || (city.name.toLowerCase().includes('douala') ? 4.0061 : 3.7226),
    lng: airportNb?.lng || city.airport?.lng || (city.name.toLowerCase().includes('douala') ? 9.7195 : 11.5532),
    active: true,
    zoneType: 'airport'
  };

  for (const nb of cityNbs) {
    // Ne pas créer un trajet sur place aéroport -> aéroport
    if (airportNb && (nb.id === airportNb.id || nb.uuid === airportNb.uuid)) {
      continue;
    }
    // Chaque quartier a son trajet unique vers l'aéroport
    pairs.push({ origin: nb, dest: airportNode });
  }

  if (pairs.length === 0) {
    throw new Error(`Aucune paire aéroport n'a pu être générée.`);
  }

  const campaignSeqId = getNextSequence('campaigns');
  const campaignUuid = randomUUID();

  const campaign: PricingCampaign = {
    id: campaignSeqId,
    uuid: campaignUuid,
    cityId: String(city.id),
    cityName: city.name,
    currency: city.currency || 'XAF',
    triggerType: 'scheduled',
    scopeMode: 'airport' as any,
    triggeredByUserId: 'cron_supabase_airport',
    triggeredByUserName: triggeredByName,
    triggeredByUserRole: 'system',
    status: 'in_progress',
    totalPairs: pairs.length,
    completedPairs: 0,
    failedPairs: 0,
    startedAt: new Date().toISOString(),
    logs: [
      {
        level: 'info',
        timestamp: new Date().toISOString(),
        message: `Démarrage de la tarification spéciale aéroport (${pairs.length} trajets) programmée par ${triggeredByName} pour ${city.name}.`
      }
    ]
  };

  const { totalChunks } = await initializeCampaignSession(campaign, city, pairs);

  // Exécution asynchrone lot par lot
  (async () => {
    try {
      console.log(`[Airport Pricing] Démarrage de la campagne aéroport #${campaignSeqId} (${pairs.length} trajets, ${totalChunks} lots - 3 workers parallèles)`);
      const CONCURRENCY = 3;
      const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i + 1);
      let nextIdx = 0;

      const runWorker = async () => {
        while (nextIdx < chunkIndices.length) {
          if (cancelledCampaignIds.has(String(campaignSeqId)) || cancelledCampaignIds.has(campaignUuid)) {
            console.log(`[Airport Pricing] Campagne aéroport #${campaignSeqId} supprimée/annulée en cours de route. Arrêt immédiat.`);
            return;
          }
          const chunkIdx = chunkIndices[nextIdx++];
          const session = campaignSessions.get(campaignUuid) || campaignSessions.get(String(campaignSeqId));
          if (!session || session.campaign.status === 'cancelled') {
            console.log(`[Airport Pricing] Campagne aéroport #${campaignSeqId} interrompue.`);
            return;
          }
          await processCampaignChunk(String(campaignSeqId), chunkIdx);
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, totalChunks) }, () => runWorker()));

      if (cancelledCampaignIds.has(String(campaignSeqId)) || cancelledCampaignIds.has(campaignUuid)) {
        return;
      }

      await finalizeCampaignExecution(String(campaignSeqId));
      console.log(`[Airport Pricing] Campagne aéroport #${campaignSeqId} terminée et enregistrée avec succès dans Supabase.`);
    } catch (err: any) {
      if (!cancelledCampaignIds.has(String(campaignSeqId))) {
        console.error(`[Airport Pricing] Erreur lors de l'exécution automatique aéroport #${campaignSeqId}:`, err.message);
      }
    }
  })();

  return { campaignId: campaignSeqId, totalPairs: pairs.length };
}
