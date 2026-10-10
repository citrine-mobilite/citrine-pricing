import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { City, Neighborhood, PricingCampaign, TripResult, CanonicalTrip } from '../types.js';
import {
  db,
  cleanFirestoreDoc,
  safeFirestoreWrite,
  saveCanonicalCampaignBatch,
  saveCanonicalCampaignResults,
  initCanonicalCampaignResults,
  loadCanonicalCampaignResults,
  isFirestoreQuotaExceeded,
  isQuotaExceededError,
  flagFirestoreQuotaExceeded
} from '../db/firestore.js';
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
  loadCanonicalTripsDiskBackup,
  saveLocalCampaignsDiskBackup
} from '../db/memoryStore.js';
import { extractAndSaveCampaignShortages } from '../db/shortageStore.js';
import { callYangoRoutestats, calculateDistanceKm } from './yangoService.js';
import { callHeroStats } from './heroService.js';
import { callTripMasterStats } from './tripMasterService.js';
import { generatePricingPairs, detectArrondissement } from '../../src/utils/routeMatrix.js';
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
export const campaignSessions = new Map<string | number, CampaignSessionState>();

function fetchWithTimeout<T>(promise: Promise<T>, ms = 5000, fallback: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export function cancelChunkCampaignSession(campaignId: string | number): boolean {
  const session = campaignSessions.get(campaignId);
  if (session) {
    session.campaign.status = 'cancelled';
    // Ne PAS supprimer de campaignSessions afin que les requêtes de lots suivantes soient rejetées immédiatement
  }
  const memCamp = memoryCampaigns.find(c => c.id === campaignId);
  if (memCamp) {
    memCamp.status = 'cancelled';
  }

  // Notification d'arrière-plan sans blocage ("Fire & Forget")
  // Même si Firestore est en panne ou hors quota, l'arrêt en RAM prend effet en 0ms
  if (db) {
    const firestorePromise = setDoc(doc(db, 'campaigns', String(campaignId)), { status: 'cancelled' }, { merge: true });
    Promise.race([
      firestorePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 1500))
    ]).catch((err) => {
      console.warn('[Firestore] Notification d\'arrêt Firestore en arrière-plan ignorée:', err?.message);
    });
  }

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

  campaignSessions.set(campaign.id, sessionState);

  // Écriture initiale unique dans Firestore des métadonnées
  if (db) {
    await safeFirestoreWrite('initCampaignMetaDoc', async () => {
      await setDoc(doc(db!, 'campaigns', String(campaign.id)), cleanFirestoreDoc(campaign));
    });
  }

  // Mémoire
  memoryCampaigns.unshift(campaign);
  memoryCampaignTrips[campaign.id] = sessionState.trips;
  memoryCampaignCanonicalTrips[campaign.id] = sessionState.canonicalTrips;

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
  let session = campaignSessions.get(campaignId) ||
    campaignSessions.get(Number(campaignId)) ||
    Array.from(campaignSessions.values()).find(s => String(s.campaign.id) === String(campaignId) || s.campaign.uuid === String(campaignId));

  // Reconstitution si le serveur a redémarré (cold start Serverless ou instance Cloud Run secondaire)
  if (!session) {
    await ensureSynced();
    let camp = memoryCampaigns.find(c => String(c.id) === String(campaignId) || c.uuid === String(campaignId));
    if (!camp && db && !isFirestoreQuotaExceeded()) {
      try {
        const snap = await getDoc(doc(db, 'campaigns', String(campaignId)));
        if (snap.exists()) camp = { id: snap.id, ...snap.data() } as PricingCampaign;
      } catch (e: any) {
        if (isQuotaExceededError(e)) flagFirestoreQuotaExceeded(e);
      }
    }

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

    const city = cities.find(c => c.id === camp?.cityId || c.uuid === camp?.cityId || String(c.id) === String(camp?.cityId)) || { id: camp.cityId, name: camp.cityName, currency: camp.currency } as City;
    const activeNbs = neighborhoods.filter(n => (n.cityId === city.id || n.cityId === city.uuid || String(n.cityId) === String(city.id)) && n.active);
    let pairs: Array<{ origin: any; dest: any }> = [];
    if (camp.scopeMode === 'airport') {
      const cityAirport = city.airport;
      let airportDest: any = null;
      if (cityAirport && cityAirport.lat && cityAirport.lng) {
        airportDest = {
          id: `airport_${city.id}`,
          cityId: String(city.uuid || city.id),
          name: cityAirport.name || `Aéroport de ${city.name}`,
          lat: cityAirport.lat,
          lng: cityAirport.lng,
          zoneType: 'airport',
          active: true
        };
      } else {
        airportDest = activeNbs.find(n =>
          n.zoneType === 'airport' ||
          n.name.toLowerCase().includes('aérop') ||
          n.name.toLowerCase().includes('aerop') ||
          n.name.toLowerCase().includes('nsimalen')
        );
      }
      if (airportDest) {
        const others = activeNbs.filter(n => String(n.id) !== String(airportDest.id) && n.name.toLowerCase().trim() !== airportDest.name.toLowerCase().trim());
        pairs = others.map(origin => ({ origin, dest: airportDest }));
      } else {
        pairs = generatePricingPairs(activeNbs);
      }
    } else {
      pairs = generatePricingPairs(activeNbs);
    }
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
      diskCanonical = loadCanonicalTripsDiskBackup(campaignId) || [];
    }

    session = {
      campaign: camp,
      city,
      chunks,
      canonicalTrips: diskCanonical,
      trips: diskTrips,
      completedPairs: Math.max(camp.completedPairs || 0, diskCanonical.length),
      failedPairs: camp.failedPairs || 0,
      completedBatches: Math.max(camp.completedBatches || 0, Math.floor(diskCanonical.length / 10)),
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
        fetchWithTimeout(callYangoRoutestats(origin.lat, origin.lng, dest.lat, dest.lng, 'econom', session.city.currency), 7000, emptyStats as any),
        fetchWithTimeout(callHeroStats(origin.lat, origin.lng, dest.lat, dest.lng, 'econom', session.city.currency, origin.name, dest.name), 7000, emptyStats as any),
        fetchWithTimeout(callTripMasterStats(origin.lat, origin.lng, dest.lat, dest.lng, session.city.currency, origin.name, dest.name), 7000, emptyStats as any)
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

      const tripSeqId = getNextSequence('trips');
      const tripUuid = randomUUID();
      const cleanOrigin = cleanNeighborhoodName(origin.name);
      const cleanDest = cleanNeighborhoodName(dest.name);

      const tripDistanceKm = (yangoStats.distanceKm && yangoStats.distanceKm > 0) ? yangoStats.distanceKm : distKm;
      const tripDurationMin = (yangoStats.durationMinutes && yangoStats.durationMinutes > 0) ? yangoStats.durationMinutes : durationMin;

      const canonicalTrip: CanonicalTrip = {
        id: tripSeqId,
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
        id: tripSeqId,
        uuid: tripUuid,
        campaignId,
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

  // Enregistrement par lot de 10 trajets dans Firestore : exactement 1 écriture par lot
  if (chunkCanonicalTrips.length > 0) {
    await saveCanonicalCampaignBatch(campaignId, session.city.name, chunkIndex, chunkCanonicalTrips);
  }

  // Synchro mémoire & disque local persistant
  memoryCampaignTrips[campaignId] = session.trips;
  memoryCampaignCanonicalTrips[campaignId] = session.canonicalTrips;
  saveCampaignTripsDiskBackup(campaignId, session.trips, session.canonicalTrips);
  saveLocalCampaignsDiskBackup();

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
  const session = campaignSessions.get(campaignId);
  const rawCampaign = session ? session.campaign : memoryCampaigns.find(c => c.id === campaignId);
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

  let canonicalTrips = session
    ? session.canonicalTrips
    : (memoryCampaignCanonicalTrips[campaignId] || loadCanonicalTripsDiskBackup(campaignId) || []);
  if (canonicalTrips.length === 0 && db && !isFirestoreQuotaExceeded()) {
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
      rMap.set(String(t.id || `${t.origin}-${t.destination}`), t);
    }
    for (const ct of clientTrips) {
      rMap.set(String(ct.id || `${ct.origin}-${ct.destination}`), ct);
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

  // Persistance Firestore finale des métadonnées ET du document consolidé unique (pour des lectures futures en 1 seule lecture)
  if (db) {
    await safeFirestoreWrite('finalizeCampaignMeta', async () => {
      await setDoc(doc(db!, 'campaigns', campaignId), cleanFirestoreDoc(campaign));
    });
    if (canonicalTrips && canonicalTrips.length > 0) {
      await saveCanonicalCampaignResults(campaignId, campaign.cityName, canonicalTrips);
    }
  }

  const existingIdx = memoryCampaigns.findIndex(c => c.id === campaignId);
  if (existingIdx >= 0) {
    memoryCampaigns[existingIdx] = campaign;
  } else {
    memoryCampaigns.unshift(campaign);
  }

  // Cache mémoire RAM serveur immédiat (0 lecture Firestore pour les futures consultations)
  if (session?.trips && session.trips.length > 0) {
    memoryCampaignTrips[campaignId] = session.trips;
  }
  if (canonicalTrips && canonicalTrips.length > 0) {
    memoryCampaignCanonicalTrips[campaignId] = canonicalTrips;
  }
  saveCampaignTripsDiskBackup(campaignId, memoryCampaignTrips[campaignId] || [], canonicalTrips);
  saveLocalCampaignsDiskBackup();

  // Enregistrement des trajets en pénurie (UNIQUEMENT à la fin de la campagne)
  try {
    extractAndSaveCampaignShortages(campaign, canonicalTrips || [], memoryCampaignTrips[campaignId] || []);
  } catch (err: any) {
    console.warn('[CampaignEngine] Warning extracting campaign shortages:', err?.message);
  }

  campaignSessions.delete(campaignId);

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
