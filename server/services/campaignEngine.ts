import { randomUUID } from 'crypto';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { City, Neighborhood, PricingCampaign, TripResult, CanonicalTrip } from '../types.js';
import { db, cleanFirestoreDoc, safeFirestoreWrite, saveCanonicalCampaignResults, initCanonicalCampaignResults } from '../db/firestore.js';
import {
  activePricingSessions,
  memoryCampaigns,
  memoryCampaignTrips,
  memoryCampaignCanonicalTrips,
  neighborhoods,
  cities,
  recordHistory
} from '../db/memoryStore.js';
import { callYangoRoutestats, calculateDistanceKm } from './yangoService.js';
import { callHeroStats } from './heroService.js';
import { callTripMasterStats } from './tripMasterService.js';
import { generateBenchmarkPairs } from '../../src/utils/routeMatrix.js';

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
  failedPairs: number;
  completedBatches: number;
  startedAtMs: number;
}

// Map local des sessions actives
const campaignSessions = new Map<string, CampaignSessionState>();

function fetchWithTimeout<T>(promise: Promise<T>, ms = 7000, fallback: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export function cancelChunkCampaignSession(campaignId: string): boolean {
  const session = campaignSessions.get(campaignId);
  if (session) {
    session.campaign.status = 'cancelled';
    campaignSessions.delete(campaignId);
    return true;
  }
  return false;
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

  // Écriture initiale dans Firestore
  if (db) {
    await safeFirestoreWrite('initCampaignMetaDoc', async () => {
      await setDoc(doc(db!, 'campaigns', campaign.id), cleanFirestoreDoc(campaign));
    });
    await initCanonicalCampaignResults(campaign.id, city.name);
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
export async function processCampaignChunk(campaignId: string, chunkIndex: number): Promise<{
  success: boolean;
  chunkIndex: number;
  completedPairs: number;
  campaign: PricingCampaign;
  chunkTrips: TripResult[];
}> {
  let session = campaignSessions.get(campaignId);

  // Reconstitution si le serveur a redémarré (cold start Serverless)
  if (!session) {
    let camp = memoryCampaigns.find(c => c.id === campaignId);
    if (!camp && db) {
      try {
        const snap = await getDoc(doc(db, 'campaigns', campaignId));
        if (snap.exists()) camp = { id: snap.id, ...snap.data() } as PricingCampaign;
      } catch {}
    }

    if (!camp) {
      throw new Error(`Campagne ${campaignId} introuvable.`);
    }

    const city = cities.find(c => c.id === camp?.cityId) || { id: camp.cityId, name: camp.cityName, currency: camp.currency } as City;
    const activeNbs = neighborhoods.filter(n => n.cityId === city.id && n.active);
    let pairs = generateBenchmarkPairs(activeNbs);
    if (camp.sampleLimit && camp.sampleLimit < pairs.length) {
      pairs = pairs.slice(0, camp.sampleLimit);
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

    session = {
      campaign: camp,
      city,
      chunks,
      canonicalTrips: memoryCampaignCanonicalTrips[campaignId] || [],
      trips: memoryCampaignTrips[campaignId] || [],
      completedPairs: camp.completedPairs || 0,
      failedPairs: camp.failedPairs || 0,
      completedBatches: camp.completedBatches || 0,
      startedAtMs: new Date(camp.startedAt).getTime() || Date.now()
    };
    campaignSessions.set(campaignId, session);
  }

  const targetChunk = session.chunks.find(c => c.chunkIndex === chunkIndex);
  if (!targetChunk || session.campaign.status === 'cancelled') {
    return {
      success: false,
      chunkIndex,
      completedPairs: session.completedPairs,
      campaign: session.campaign,
      chunkTrips: []
    };
  }

  const chunkTrips: TripResult[] = [];
  const chunkCanonicalTrips: CanonicalTrip[] = [];

  const emptyStats = { price: null, priceEconom: null, priceConfort: null, priceStandard: null, priceEco: null };

  await Promise.all(targetChunk.pairs.map(async (pair) => {
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

      const tripId = randomUUID();
      const cleanOrigin = cleanNeighborhoodName(origin.name);
      const cleanDest = cleanNeighborhoodName(dest.name);

      const canonicalTrip: CanonicalTrip = {
        id: tripId,
        origin: cleanOrigin,
        destination: cleanDest,
        distanceKm: distKm,
        durationMin: durationMin,
        prices: {
          yango: { eco: yEco, confort: yConf, confortPlus: yConfPlus, moto: yMoto },
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
        id: tripId,
        campaignId,
        cityId: session.city.id,
        cityName: session.city.name,
        startNeighborhoodId: origin.id,
        startNeighborhoodName: cleanOrigin,
        endNeighborhoodId: dest.id,
        endNeighborhoodName: cleanDest,
        distanceMeters: Math.round(distKm * 1000),
        distanceKm: distKm,
        durationSeconds: durationMin * 60,
        durationMinutes: durationMin,
        tariffClass: 'econom',
        price: yEco || hEco || tmEco || 0,
        priceFormatted: `${(yEco || hEco || tmEco || 0).toLocaleString('fr-FR')} ${session.city.currency}`,
        currency: session.city.currency,
        pricePerKm: distKm > 0 ? Math.round((yEco || hEco || tmEco || 0) / distKm) : 0,
        priceEconom: yEco || undefined,
        priceConfort: yConf || undefined,
        priceConfortPlus: yConfPlus || undefined,
        priceMoto: yMoto || undefined,
        priceHero: hEco || undefined,
        priceHeroStandard: hEco || undefined,
        priceHeroConfort: hConf || undefined,
        priceHeroSuv: hSuv || undefined,
        priceHeroPerKm: hPerKm || undefined,
        priceTripMaster: tmEco || undefined,
        priceTripMasterConfort: tmConf || undefined,
        priceTripMasterMoto: tmMoto || undefined,
        yango_eco: yEco || undefined,
        yango_confort: yConf || undefined,
        yango_moto: yMoto || undefined,
        hero_eco: hEco || undefined,
        hero_confort: hConf || undefined,
        hero_suv: hSuv || undefined,
        tripmaster_eco: tmEco || undefined,
        tripmaster_confort: tmConf || undefined,
        tripmaster_moto: tmMoto || undefined,
        cheaperProvider: cheaperEco as any,
        deltaPriceYangoVsHero: deltaEco,
        source: 'yango_live',
        status: (yEco || hEco || tmEco) ? 'success' : 'failed',
        createdAt: new Date().toISOString()
      };

      chunkCanonicalTrips.push(canonicalTrip);
      chunkTrips.push(tripRow);
      session.canonicalTrips.push(canonicalTrip);
      session.trips.push(tripRow);

      if (yEco || hEco || tmEco) session.completedPairs++;
      else session.failedPairs++;
    } catch {
      session.failedPairs++;
    }
  }));

  session.completedBatches++;
  session.campaign.completedPairs = session.completedPairs;
  session.campaign.failedPairs = session.failedPairs;
  session.campaign.completedBatches = session.completedBatches;
  session.campaign.durationSeconds = Math.max(1, Math.round((Date.now() - session.startedAtMs) / 1000));

  // Sauvegarde progressive Firestore
  if (session.canonicalTrips.length > 0) {
    await saveCanonicalCampaignResults(campaignId, session.city.name, session.canonicalTrips);
  }
  if (db) {
    await safeFirestoreWrite('updateCampaignProgress', async () => {
      await setDoc(doc(db!, 'campaigns', campaignId), cleanFirestoreDoc(session!.campaign), { merge: true });
    });
  }

  // Synchro mémoire
  memoryCampaignTrips[campaignId] = session.trips;
  memoryCampaignCanonicalTrips[campaignId] = session.canonicalTrips;

  return {
    success: true,
    chunkIndex,
    completedPairs: session.completedPairs,
    campaign: session.campaign,
    chunkTrips
  };
}

/**
 * 3. Finalisation globale de la campagne
 */
export async function finalizeCampaignExecution(campaignId: string): Promise<PricingCampaign> {
  const session = campaignSessions.get(campaignId);
  const campaign = session ? session.campaign : memoryCampaigns.find(c => c.id === campaignId);

  if (!campaign) {
    throw new Error(`Campagne ${campaignId} introuvable pour finalisation.`);
  }

  const canonicalTrips = session ? session.canonicalTrips : memoryCampaignCanonicalTrips[campaignId] || [];

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
  campaign.status = 'completed';
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
    avgClosestDriverDistanceKm: 0
  };

  campaign.tripMasterStats = {
    avgPrice: countTm > 0 ? Math.round(sumTmEco / countTm) : 0,
    minPrice: 0,
    maxPrice: 0
  };

  campaign.deltaStats = {
    yangoCheaperCount: yangoCheaper,
    heroCheaperCount: heroCheaper,
    equalCount,
    avgDeltaFcfa: completed > 0 ? Math.round(totalDelta / completed) : 0
  };

  campaign.canonicalTripsCount = canonicalTrips.length;

  // Persistance Firestore finale
  if (db) {
    await safeFirestoreWrite('finalizeCampaignMeta', async () => {
      await setDoc(doc(db!, 'campaigns', campaignId), cleanFirestoreDoc(campaign));
    });
  }

  if (canonicalTrips.length > 0) {
    await saveCanonicalCampaignResults(campaignId, campaign.cityName, canonicalTrips);
  }

  const existingIdx = memoryCampaigns.findIndex(c => c.id === campaignId);
  if (existingIdx >= 0) {
    memoryCampaigns[existingIdx] = campaign;
  } else {
    memoryCampaigns.unshift(campaign);
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
