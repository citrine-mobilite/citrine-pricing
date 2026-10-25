import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { City, Neighborhood, PricingCampaign, TripResult, CanonicalTrip } from '../types.js';
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
  saveLocalCampaignsDiskBackup,
  dedupeCampaigns,
  campaignMatchesId
} from '../db/memoryStore.js';
import {
  saveCampaignResultsInSupabase,
  saveCampaignShortagesInSupabase,
  bulkInsertTripsInPostgres,
  saveCampaignTripChunkInSupabase,
  upsertCampaignInSupabase,
  deleteCampaignInSupabase
} from '../db/supabase.js';
import { extractAndSaveCampaignShortages } from '../db/shortageStore.js';
import { callYangoRoutestats, calculateDistanceKm } from './yangoService.js';
import { callHeroStats } from './heroService.js';
import { callTripMasterStats } from './tripMasterService.js';
import { generatePricingPairs, detectArrondissement, isAirportNeighborhood } from '../../src/utils/routeMatrix.js';
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

function fetchWithTimeout<T>(promise: Promise<T>, ms = 5000, defaultValue: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(defaultValue), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function getTrustedCompletedPairs(campaign: PricingCampaign, defaultValue: number): number {
  const expectedTotal = Math.max(0, Number(campaign.totalPairs) || 0);
  const currentValue = Math.max(0, Number(defaultValue) || 0);

  if (expectedTotal > 0) {
    return Math.min(Math.max(currentValue, 0), expectedTotal);
  }

  return Math.max(currentValue, 0);
}

export function cancelChunkCampaignSession(campaignId: string | number): boolean {
  const session = campaignSessions.get(campaignId) ||
    campaignSessions.get(Number(campaignId)) ||
    Array.from(campaignSessions.values()).find(s => campaignMatchesId(s.campaign, campaignId));
  if (session) {
    session.campaign.status = 'cancelled';
    session.campaign.finalizing = false;
    // Ne PAS supprimer de campaignSessions afin que les requêtes de lots suivantes soient rejetées immédiatement
  }
  const memCamp = memoryCampaigns.find(c => campaignMatchesId(c, campaignId));
  if (memCamp) {
    memCamp.status = 'cancelled';
    memCamp.finalizing = false;
  }

  // Persistance du statut annulé dans Supabase PostgreSQL
  if (session?.campaign) {
    upsertCampaignInSupabase({ ...session.campaign, status: 'cancelled' }).catch(() => {});
  }

  return true;
}

/**
 * Règle Watchdog Automatique :
 * Si après 1 minute (60 secondes) 0 trajet n'a été traité sur une campagne lancée,
 * la campagne est automatiquement supprimée de la mémoire et du disque.
 */
export function registerCampaignWatchdog(campaignId: string | number) {
  setTimeout(async () => {
    try {
      const targetId = String(campaignId);
      const session = campaignSessions.get(campaignId) || campaignSessions.get(Number(campaignId)) || Array.from(campaignSessions.values()).find(s => campaignMatchesId(s.campaign, campaignId));
      const camp = session?.campaign || memoryCampaigns.find(c => campaignMatchesId(c, campaignId));
      
      const isStillPendingOrActive = camp && (camp.status === 'in_progress' || !camp.status);
      const hasZeroCompleted = !camp?.completedPairs || camp.completedPairs === 0;

      if (isStillPendingOrActive && hasZeroCompleted) {
        console.warn(`[Watchdog 1 min] Campagne #${targetId} toujours à 0 trajet après 60s -> Suppression automatique.`);
        
        // 1. Annuler la session
        cancelChunkCampaignSession(campaignId);
        
        // 2. Nettoyer les sessions actives
        campaignSessions.delete(campaignId);
        campaignSessions.delete(Number(campaignId));
        campaignSessions.delete(targetId);
        
        // 3. Supprimer de memoryCampaigns
        const idx = memoryCampaigns.findIndex(c => campaignMatchesId(c, targetId));
        if (idx >= 0) {
          memoryCampaigns.splice(idx, 1);
        }
        
        // 4. Mettre à jour le disque local immédiatement
        saveLocalCampaignsDiskBackup();
        
        // 5. Supprimer de Supabase
        deleteCampaignInSupabase(targetId).catch(() => {});
        
        // 6. Historique d'audit
        recordHistory({
          action: 'delete_campaign',
          eventType: 'campaign',
          title: `Suppression automatique (0 trajet après 1 min): Campagne #${targetId}`,
          description: `La campagne #${targetId} a été purgée automatiquement car 0 trajet n'a été traité après 60 secondes.`,
          performedBy: 'system_watchdog',
          performedByName: 'Système Watchdog (1 min)'
        }).catch(() => {});
      }
    } catch (err: any) {
      console.warn('[Watchdog Warning]:', err.message);
    }
  }, 60000);
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
  campaign.workersCount = Math.min(20, Math.max(1, chunks.length));
  campaign.status = 'in_progress';
  campaign.finalizing = false;

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
  campaignSessions.set(Number(campaign.id), sessionState);
  campaignSessions.set(String(campaign.id), sessionState);

  // Sauvegarde initiale dans Supabase PostgreSQL
  upsertCampaignInSupabase(campaign).catch(() => {});

  // Mémoire - garantir une seule occurrence de la campagne même si des doublons sont déjà présents
  const dedupedInitial = dedupeCampaigns([campaign, ...memoryCampaigns]);
  memoryCampaigns.splice(0, memoryCampaigns.length, ...dedupedInitial);
  memoryCampaignTrips[campaign.id] = sessionState.trips;
  memoryCampaignCanonicalTrips[campaign.id] = sessionState.canonicalTrips;

  // Activer la surveillance automatique Watchdog 1 min (suppression automatique si 0 trajet après 60s)
  registerCampaignWatchdog(campaign.id);

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
    const activeNbs = neighborhoods.filter(n => (
      String(n.cityId ?? '') === String(city.id ?? '') ||
      String(n.cityId ?? '') === String(city.uuid ?? '') ||
      String(city.id ?? '') === String(n.cityId ?? '')
    ) && n.active);
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
        airportDest = activeNbs.find(n => isAirportNeighborhood(n));
      }
      if (airportDest) {
        const others = activeNbs.filter(n => !isAirportNeighborhood(n) && String(n.id) !== String(airportDest.id));
        pairs = others.map(origin => ({ origin, dest: airportDest }));
      } else {
        pairs = generatePricingPairs(activeNbs.filter(n => !isAirportNeighborhood(n)), { sampleLimit: camp.sampleLimit });
      }
    } else {
      const nonAirportNbs = activeNbs.filter(n => !isAirportNeighborhood(n));
      pairs = generatePricingPairs(nonAirportNbs, { sampleLimit: camp.sampleLimit }).filter(p => !isAirportNeighborhood(p.origin) && !isAirportNeighborhood(p.dest));
    }
    const limitNum = typeof camp.sampleLimit === 'number' ? camp.sampleLimit : (camp.sampleLimit && String(camp.sampleLimit) !== 'all' ? parseInt(String(camp.sampleLimit), 10) : undefined);
    if (limitNum && limitNum < pairs.length) {
      if (limitNum <= 50) {
        const shuffled = [...pairs];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        pairs = shuffled.slice(0, limitNum);
      } else {
        pairs = pairs.slice(0, limitNum);
      }
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

  const memCamp = memoryCampaigns.find(c => c.id === campaignId || c.uuid === campaignId || String(c.id) === String(campaignId) || String(c.uuid) === String(campaignId));
  const targetChunk = session.chunks.find(c => c.chunkIndex === chunkIndex);
  const sessionCancelled = Boolean(session && session.campaign.status === 'cancelled');
  const staleMemoryCancelled = !session && Boolean(memCamp && memCamp.status === 'cancelled');

  if (!targetChunk || sessionCancelled || staleMemoryCancelled) {
    if (session) session.campaign.status = 'cancelled';
    if (memCamp && !session) memCamp.status = 'cancelled';
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

  // Traitement concurrent optimisé par sous-groupes de 3 paires simultanées (accélération x3 sans surcharge réseau)
  const PAIR_CONCURRENCY = 25;
  for (let pIdx = 0; pIdx < targetChunk.pairs.length; pIdx += PAIR_CONCURRENCY) {
    const activeSessionCancelled = session && session.campaign.status === 'cancelled';
    const staleCacheCancelled = !session && Boolean(memCamp && memCamp.status === 'cancelled');
    if (activeSessionCancelled || staleCacheCancelled) {
      break;
    }
    const currentSubBatch = targetChunk.pairs.slice(pIdx, pIdx + PAIR_CONCURRENCY);
    await Promise.all(currentSubBatch.map(async (pair) => {
      const { origin, dest } = pair;
      // Distance/Duration calculée seulement si nécessaire
      
      try {
        const [yangoStats, heroStats, tmStats] = await Promise.all([
          fetchWithTimeout(callYangoRoutestats(origin.lat, origin.lng, dest.lat, dest.lng, 'econom', session.city.currency), 7000, emptyStats as any),
          fetchWithTimeout(callHeroStats(origin.lat, origin.lng, dest.lat, dest.lng, 'econom', session.city.currency, origin.name, dest.name), 7000, emptyStats as any),
          fetchWithTimeout(callTripMasterStats(origin.lat, origin.lng, dest.lat, dest.lng, session.city.currency, origin.name, dest.name), 7000, emptyStats as any)
        ]);

        let tripDistanceKm = (yangoStats.distanceKm && yangoStats.distanceKm > 0) ? yangoStats.distanceKm : 0;
        if (tripDistanceKm === 0) tripDistanceKm = calculateDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng);

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

        const fallbackDuration = Math.max(2, Math.round((tripDistanceKm / 25) * 60));
        const tripDurationMin = (yangoStats.durationMinutes && yangoStats.durationMinutes > 0) 
            ? yangoStats.durationMinutes 
            : fallbackDuration;

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
              yangoUnavailable: Boolean(yangoStats.yangoUnavailable),
              rawResponse: yangoStats.rawJson
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
              yangoUnavailable: Boolean(yangoStats.yangoUnavailable),
              rawResponse: yangoStats.rawJson
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
      } catch {
        const tripSeqId = getNextSequence('trips');
        const tripUuid = randomUUID();
        const cleanOrigin = cleanNeighborhoodName(origin.name);
        const cleanDest = cleanNeighborhoodName(dest.name);
        const distKm = calculateDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng);
        const durationMin = Math.max(2, Math.round((distKm / 25) * 60));
        const fallbackCanonical: CanonicalTrip = {
          id: tripSeqId,
          uuid: tripUuid,
          origin: cleanOrigin,
          destination: cleanDest,
          distanceKm: distKm,
          durationMin,
          jams: false,
          yangoUnavailable: false,
          prices: {
            yango: { eco: null, confort: null, confortPlus: null, moto: null },
            heroCab: { eco: null, confort: null, suv: null, perKm: null },
            tripMaster: { eco: null, confort: null, moto: null }
          },
          cheapest: { eco: null, confort: null, overall: null },
          status: 'failed',
          createdAt: new Date().toISOString()
        };
        const fallbackTripRow: TripResult = {
          id: tripSeqId,
          uuid: tripUuid,
          campaignId,
          origin: cleanOrigin,
          destination: cleanDest,
          distanceKm: distKm,
          durationMinutes: durationMin,
          jams: false,
          yangoUnavailable: false,
          prices: fallbackCanonical.prices,
          cheapest: fallbackCanonical.cheapest,
          status: 'failed',
          createdAt: fallbackCanonical.createdAt
        };
        chunkCanonicalTrips.push(fallbackCanonical);
        chunkTrips.push(fallbackTripRow);
        session.canonicalTrips.push(fallbackCanonical);
        session.trips.push(fallbackTripRow);
        session.failedPairs++;
      }
    }));
  }

  session.completedPairs = session.canonicalTrips.length;
  session.completedBatches = Math.max(session.completedBatches || 0, chunkIndex);
  session.campaign.completedPairs = session.canonicalTrips.length;
  session.campaign.failedPairs = session.failedPairs;
  session.campaign.completedBatches = session.completedBatches;
  session.campaign.durationSeconds = Math.max(1, Math.round((Date.now() - session.startedAtMs) / 1000));

  // Trajets (trips) conservés en RAM pendant le relevé pour une rapidité maximale (0 écriture réseau/disque bloquante par lot).
  // L'enregistrement en base de données et sur disque se fera en masse à la toute fin de la campagne.
  memoryCampaignTrips[campaignId] = session.trips;
  memoryCampaignCanonicalTrips[campaignId] = session.canonicalTrips;

  // Persistance périodique sur disque pour que les actualisations et redémarrages affichent la progression réelle
  if (chunkIndex % 10 === 0 || session.completedPairs >= session.campaign.totalPairs) {
    saveLocalCampaignsDiskBackup();
  }

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
  const session = campaignSessions.get(campaignId) ||
    campaignSessions.get(Number(campaignId)) ||
    Array.from(campaignSessions.values()).find(s => campaignMatchesId(s.campaign, campaignId));
  const rawCampaign = session ? session.campaign : memoryCampaigns.find(c => campaignMatchesId(c, campaignId));
  let campaign: PricingCampaign;

  const sessionCancelled = Boolean(session && session.campaign.status === 'cancelled');
  const staleMemoryCancelled = !session && Boolean(rawCampaign && rawCampaign.status === 'cancelled');

  if (rawCampaign && (rawCampaign.status === 'completed' || rawCampaign.finalizing)) {
    return rawCampaign;
  }
  if (sessionCancelled || staleMemoryCancelled) {
    return rawCampaign || session?.campaign || { id: campaignId, status: 'cancelled' } as PricingCampaign;
  }

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

  if (campaign) {
    campaign.finalizing = true;
  }
  if (session) {
    session.campaign.finalizing = true;
  }

  let canonicalTrips = session
    ? session.canonicalTrips
    : (memoryCampaignCanonicalTrips[campaignId] || loadCanonicalTripsDiskBackup(campaignId) || []);

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
  campaign.finalizing = false;
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

  // Persistance Supabase PostgreSQL (sans quota et avec requêtes relationnelles)
  await upsertCampaignInSupabase(campaign);
  if (canonicalTrips && canonicalTrips.length > 0) {
    await saveCampaignResultsInSupabase(campaignId, campaign.cityName, canonicalTrips, campaign.uuid);
  }

  const existingIdx = memoryCampaigns.findIndex(c => c.id === campaignId || c.uuid === campaignId || String(c.id) === String(campaignId));
  if (existingIdx >= 0) {
    memoryCampaigns[existingIdx] = campaign;
  } else {
    memoryCampaigns.unshift(campaign);
  }
  const dedupedFinal = dedupeCampaigns(memoryCampaigns);
  memoryCampaigns.splice(0, memoryCampaigns.length, ...dedupedFinal);

  // Cache mémoire RAM serveur immédiat (0 lecture Firestore pour les futures consultations)
  let finalTrips = (session?.trips && session.trips.length > 0) ? session.trips : (memoryCampaignTrips[campaignId] || []);
  if (Array.isArray(clientTrips) && clientTrips.length > 0) {
    const rMap = new Map<string, TripResult>();
    for (const t of finalTrips) {
      rMap.set(String(t.id || `${t.origin}-${t.destination}`), t);
    }
    for (const ct of clientTrips) {
      rMap.set(String(ct.id || `${ct.origin}-${ct.destination}`), ct);
    }
    finalTrips = Array.from(rMap.values());
  }

  // Si finalTrips est vide mais que canonicalTrips existe, générer les TripResult correspondants
  if (finalTrips.length === 0 && canonicalTrips.length > 0) {
    finalTrips = canonicalTrips.map(ct => ({
      id: ct.id,
      uuid: ct.uuid,
      campaignId: String(campaign.id),
      origin: ct.origin,
      destination: ct.destination,
      distanceKm: ct.distanceKm,
      durationMinutes: ct.durationMin,
      jams: ct.jams,
      yangoUnavailable: ct.yangoUnavailable,
      yangoWaitingMinutes: ct.yangoWaitingMinutes,
      yangoUnavailableClasses: ct.yangoUnavailableClasses,
      prices: ct.prices,
      cheapest: ct.cheapest,
      status: ct.status,
      createdAt: ct.createdAt
    }));
  }

  memoryCampaignTrips[campaignId] = finalTrips;
  memoryCampaignTrips[String(campaign.id)] = finalTrips;
  if (campaign.uuid) memoryCampaignTrips[campaign.uuid] = finalTrips;

  memoryCampaignCanonicalTrips[campaignId] = canonicalTrips;
  memoryCampaignCanonicalTrips[String(campaign.id)] = canonicalTrips;
  if (campaign.uuid) memoryCampaignCanonicalTrips[campaign.uuid] = canonicalTrips;

  saveCampaignTripsDiskBackup(campaign.id, finalTrips, canonicalTrips);
  if (campaign.uuid && campaign.uuid !== String(campaign.id)) {
    saveCampaignTripsDiskBackup(campaign.uuid, finalTrips, canonicalTrips);
  }
  saveLocalCampaignsDiskBackup();

  // Enregistrement des trajets en pénurie (UNIQUEMENT à la fin de la campagne)
  try {
    const shortageRecords = extractAndSaveCampaignShortages(campaign, canonicalTrips || [], memoryCampaignTrips[campaignId] || []);
    if (shortageRecords.length > 0) {
      await saveCampaignShortagesInSupabase(campaign.id, campaign.uuid, campaign.cityName, shortageRecords);
    }
  } catch (err: any) {
    console.warn('[CampaignEngine] Warning extracting campaign shortages:', err?.message);
  }

  if (session) {
    session.campaign.finalizing = false;
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

/**
 * Exécution automatique complète en arrière-plan d'une campagne de tarification générale (8h, 13h, 18h)
 */
export async function runAutomatedServerCampaign(
  targetCityId?: string | number,
  triggeredByName: string = 'Cron Supabase (8h, 13h, 18h)'
): Promise<{ campaignId: number; totalPairs: number }> {
  await ensureSynced();

  const city = cities.find(c => 
    targetCityId 
      ? (c.id === targetCityId || String(c.id) === String(targetCityId) || c.uuid === targetCityId)
      : c.active
  ) || cities[0];

  if (!city || !city.active) {
    throw new Error(`Aucune ville active trouvée pour exécuter le pricing automatique.`);
  }

  const activeNbs = neighborhoods.filter(n => (
    String(n.cityId ?? '') === String(city.id ?? '') ||
    String(n.cityId ?? '') === String(city.uuid ?? '') ||
    String(city.id ?? '') === String(n.cityId ?? '')
  ) && n.active);

  const nonAirportNbs = activeNbs.filter(n => !isAirportNeighborhood(n));
  if (nonAirportNbs.length < 2) {
    throw new Error(`Moins de 2 quartiers actifs non-aéroportuaires pour ${city.name}.`);
  }

  const pairs = generatePricingPairs(nonAirportNbs);
  const campaignSeqId = getNextSequence('campaigns');
  const campaignUuid = randomUUID();

  const campaign: PricingCampaign = {
    id: campaignSeqId,
    uuid: campaignUuid,
    cityId: String(city.uuid || city.id),
    cityName: city.name,
    currency: city.currency || 'XAF',
    triggerType: 'scheduled',
    triggeredByUserId: 'cron_supabase',
    triggeredByUserName: triggeredByName,
    triggeredByUserRole: 'system',
    status: 'in_progress',
    campaignType: 'all',
    scopeMode: 'city',
    totalPairs: pairs.length,
    completedPairs: 0,
    failedPairs: 0,
    startedAt: new Date().toISOString(),
    logs: [
      {
        level: 'info',
        timestamp: new Date().toISOString(),
        message: `Démarrage de la tarification automatique générale (${pairs.length} trajets) programmée par ${triggeredByName} pour ${city.name}.`
      }
    ]
  };

  await upsertCampaignInSupabase(campaign);
  const { totalChunks } = await initializeCampaignSession(campaign, city, pairs);
  saveLocalCampaignsDiskBackup();

  await recordHistory({
    action: 'start_campaign',
    eventType: 'campaign',
    title: `Démarrage de campagne automatique (Pricing): ${city.name}`,
    description: `${pairs.length} trajets prévus (${totalChunks} lots).`,
    performedByName: triggeredByName,
    performedBy: 'cron_supabase'
  });

  // Exécution asynchrone haute performance et résiliente en arrière-plan
  (async () => {
    try {
      console.log(`[Cron Pricing 8h-13h-18h] Démarrage de la campagne #${campaignSeqId} (${pairs.length} trajets, ${totalChunks} lots)`);
      const BATCH_PARALLEL = 3;
      for (let chunkIdx = 1; chunkIdx <= totalChunks; chunkIdx += BATCH_PARALLEL) {
        const session = campaignSessions.get(campaignSeqId) || campaignSessions.get(Number(campaignSeqId));
        if (!session || session.campaign.status === 'cancelled') {
          console.log(`[Cron Pricing 8h-13h-18h] Campagne #${campaignSeqId} interrompue.`);
          break;
        }
        const batchGroup: number[] = [];
        for (let b = 0; b < BATCH_PARALLEL && (chunkIdx + b) <= totalChunks; b++) {
          batchGroup.push(chunkIdx + b);
        }
        try {
          await Promise.allSettled(batchGroup.map(idx => processCampaignChunk(String(campaignSeqId), idx)));
          saveLocalCampaignsDiskBackup();
          await new Promise(r => setTimeout(r, 150));
        } catch (batchErr: any) {
          console.warn(`[Cron Pricing 8h-13h-18h] Erreur sur le lot ${chunkIdx}:`, batchErr.message);
        }
      }

      await finalizeCampaignExecution(String(campaignSeqId));
      console.log(`[Cron Pricing 8h-13h-18h] Campagne #${campaignSeqId} terminée et enregistrée avec succès.`);
    } catch (err: any) {
      console.error(`[Cron Pricing 8h-13h-18h] Erreur lors de l'exécution automatique #${campaignSeqId}:`, err.message);
    }
  })();

  return { campaignId: campaignSeqId, totalPairs: pairs.length };
}

/**
 * Exécution automatique complète en arrière-plan d'une campagne de tarification dédiée AÉROPORT (20h, 23h, 2h)
 */
export async function runAutomatedAirportCampaign(
  targetCityId?: string | number,
  triggeredByName: string = 'Cron Aéroport (20h, 23h, 2h)'
): Promise<{ campaignId: number; totalPairs: number }> {
  await ensureSynced();

  const city = cities.find(c => 
    targetCityId 
      ? (c.id === targetCityId || String(c.id) === String(targetCityId) || c.uuid === targetCityId)
      : c.active
  ) || cities[0];

  if (!city || !city.active) {
    throw new Error(`Aucune ville active trouvée pour exécuter le pricing aéroport.`);
  }

  const activeNbs = neighborhoods.filter(n => (
    String(n.cityId ?? '') === String(city.id ?? '') ||
    String(n.cityId ?? '') === String(city.uuid ?? '') ||
    String(city.id ?? '') === String(n.cityId ?? '')
  ) && n.active);

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
    airportDest = activeNbs.find(n => isAirportNeighborhood(n));
  }

  if (!airportDest) {
    throw new Error(`Coordonnées de l'aéroport non configurées pour ${city.name}. Renseignez l'aéroport dans la gestion des villes.`);
  }

  const standardOrigins = activeNbs.filter(n => !isAirportNeighborhood(n) && String(n.id) !== String(airportDest.id));
  if (standardOrigins.length === 0) {
    throw new Error(`Aucun quartier d'origine actif trouvé pour les trajets aéroport à ${city.name}.`);
  }

  const pairs: Array<{ origin: Neighborhood; dest: Neighborhood }> = standardOrigins.map(origin => ({
    origin,
    dest: airportDest
  }));

  const campaignSeqId = getNextSequence('campaigns');
  const campaignUuid = randomUUID();

  const campaign: PricingCampaign = {
    id: campaignSeqId,
    uuid: campaignUuid,
    cityId: String(city.uuid || city.id),
    cityName: city.name,
    currency: city.currency || 'XAF',
    triggerType: 'scheduled',
    triggeredByUserId: 'cron_airport',
    triggeredByUserName: triggeredByName,
    triggeredByUserRole: 'system',
    status: 'in_progress',
    campaignType: 'aeroport',
    scopeMode: 'airport',
    comment: 'Relevé automatique exclusif des destinations vers l’Aéroport (20h, 23h, 2h)',
    totalPairs: pairs.length,
    completedPairs: 0,
    failedPairs: 0,
    startedAt: new Date().toISOString(),
    logs: [
      {
        level: 'info',
        timestamp: new Date().toISOString(),
        message: `Démarrage de la tarification automatique Aéroport (${pairs.length} trajets vers l'aéroport) programmée par ${triggeredByName} pour ${city.name}.`
      }
    ]
  };

  await upsertCampaignInSupabase(campaign);
  const { totalChunks } = await initializeCampaignSession(campaign, city, pairs);
  saveLocalCampaignsDiskBackup();

  await recordHistory({
    action: 'start_campaign',
    eventType: 'campaign',
    title: `Démarrage de campagne automatique Aéroport: ${city.name}`,
    description: `${pairs.length} trajets vers l'aéroport prévus (${totalChunks} lots).`,
    performedByName: triggeredByName,
    performedBy: 'cron_airport'
  });

  // Exécution asynchrone haute performance et résiliente en arrière-plan
  (async () => {
    try {
      console.log(`[Cron Airport 20h-23h-2h] Démarrage de la campagne #${campaignSeqId} (${pairs.length} trajets, ${totalChunks} lots)`);
      const BATCH_PARALLEL = 3;
      for (let chunkIdx = 1; chunkIdx <= totalChunks; chunkIdx += BATCH_PARALLEL) {
        const session = campaignSessions.get(campaignSeqId) || campaignSessions.get(Number(campaignSeqId));
        if (!session || session.campaign.status === 'cancelled') {
          console.log(`[Cron Airport 20h-23h-2h] Campagne #${campaignSeqId} interrompue.`);
          break;
        }
        const batchGroup: number[] = [];
        for (let b = 0; b < BATCH_PARALLEL && (chunkIdx + b) <= totalChunks; b++) {
          batchGroup.push(chunkIdx + b);
        }
        try {
          await Promise.allSettled(batchGroup.map(idx => processCampaignChunk(String(campaignSeqId), idx)));
          saveLocalCampaignsDiskBackup();
          await new Promise(r => setTimeout(r, 150));
        } catch (batchErr: any) {
          console.warn(`[Cron Airport 20h-23h-2h] Erreur sur le lot ${chunkIdx}:`, batchErr.message);
        }
      }

      await finalizeCampaignExecution(String(campaignSeqId));
      console.log(`[Cron Airport 20h-23h-2h] Campagne #${campaignSeqId} terminée et enregistrée avec succès.`);
    } catch (err: any) {
      console.error(`[Cron Airport 20h-23h-2h] Erreur lors de l'exécution automatique #${campaignSeqId}:`, err.message);
    }
  })();

  return { campaignId: campaignSeqId, totalPairs: pairs.length };
}
