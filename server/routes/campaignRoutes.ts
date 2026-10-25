import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  cities,
  neighborhoods,
  users,
  memoryCampaigns,
  memoryCampaignTrips,
  memoryCampaignCanonicalTrips,
  activePricingSessions,
  recordHistory,
  deleteHistoryForCampaign,
  ensureSynced,
  saveLocalCampaignsDiskBackup,
  loadLocalCampaignsDiskBackup,
  saveCampaignTripsDiskBackup,
  loadCampaignTripsDiskBackup,
  loadCanonicalTripsDiskBackup,
  deleteCampaignTripsDiskBackup,
  deleteAllCampaignTripsDiskBackup,
  campaignMatchesId,
  dedupeCampaigns
} from '../db/memoryStore.js';
import { PricingCampaign, CanonicalTrip, TripResult } from '../types.js';
import { deleteShortagesForCampaign, clearAllShortages } from '../db/shortageStore.js';
import {
  initializeCampaignSession,
  processCampaignChunk,
  finalizeCampaignExecution,
  cancelChunkCampaignSession,
  cleanNeighborhoodName,
  campaignSessions,
  runAutomatedServerCampaign,
  runAutomatedAirportCampaign
} from '../services/campaignEngine.js';
import {
  upsertCampaignInSupabase,
  deleteCampaignInSupabase,
  fetchCampaignsFromSupabase,
  fetchCampaignResultsFromSupabase
} from '../db/supabase.js';
import {
  generatePricingPairs,
  calculatePossiblePricingPairsCount,
  detectArrondissement,
  isAirportNeighborhood
} from '../../src/utils/routeMatrix.js';

import { getNextSequence } from '../db/counters.js';

const router = Router();

function matchesCityId(value: string | number | undefined | null, target: string | number | undefined | null): boolean {
  const left = String(value ?? '').trim();
  const right = String(target ?? '').trim();
  if (!left || !right) return false;
  return left === right || left === `city_${right}` || right === `city_${left}` || left === `uuid_${right}` || right === `uuid_${left}`;
}

// Helper pour trouver une campagne par son id numérique ou son uuid
function findCampaign(idOrUuid: string | number): PricingCampaign | undefined {
  const target = String(idOrUuid);
  const session = campaignSessions.get(idOrUuid) || campaignSessions.get(Number(idOrUuid)) || Array.from(campaignSessions.values()).find(s => campaignMatchesId(s.campaign, idOrUuid));
  if (session) return session.campaign;

  const inMemory = memoryCampaigns.find(c => campaignMatchesId(c, target) || campaignMatchesId(c, Number(target)) || String(c.id) === target || c.uuid === target);
  if (inMemory) return inMemory;

  // Vérification sur le disque si elle n'est pas encore synchronisée en RAM
  try {
    const campsFile = path.resolve(process.cwd(), 'server/data/campaigns.json');
    if (fs.existsSync(campsFile)) {
      const raw = fs.readFileSync(campsFile, 'utf8');
      const diskCamps = JSON.parse(raw);
      if (Array.isArray(diskCamps)) {
        const found = diskCamps.find(c => campaignMatchesId(c, target) || String(c.id) === target || c.uuid === target);
        if (found) {
          memoryCampaigns.unshift(found);
          return found;
        }
      }
    }
  } catch {}
  return undefined;
}

// 1. Liste des campagnes (100% Mémoire Vive Serveur & Disque local - 0 lecture Firestore)
router.get('/api/campaigns', async (_req: Request, res: Response) => {
  if (memoryCampaigns.length === 0) {
    loadLocalCampaignsDiskBackup();
  }
  let list: PricingCampaign[] = [...memoryCampaigns];

  // Fusion avec les campagnes actives en mémoire (Chunking sessions & Worker sessions)
  for (const [id, session] of campaignSessions.entries()) {
    const idx = list.findIndex(c => String(c.id) === String(id) || c.uuid === id || campaignMatchesId(c, String(id)));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...session.campaign };
    } else {
      list.unshift({ ...session.campaign });
    }
  }
  for (const [id, session] of activePricingSessions.entries()) {
    const idx = list.findIndex(c => String(c.id) === String(id) || c.uuid === id || campaignMatchesId(c, String(id)));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...session.campaign };
    } else {
      list.unshift({ ...session.campaign });
    }
  }

  list = dedupeCampaigns(list);
  list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  // Nettoyage des campagnes réellement terminées
  list = list.map(c => {
    if (c.status === 'in_progress') {
      const isActuallyFinished = c.completedPairs && c.totalPairs && c.completedPairs >= c.totalPairs;
      if (isActuallyFinished) {
        return { ...c, status: 'completed' };
      }
    }
    return c;
  });

  return res.json(list);
});

// Route de synchronisation du cache local client vers la mémoire et le disque du serveur
router.post('/api/campaigns/sync-cache', (req: Request, res: Response) => {
  const { campaigns: clientCampaigns } = req.body;
  if (Array.isArray(clientCampaigns) && clientCampaigns.length > 0) {
    let added = 0;
    for (const c of clientCampaigns) {
      if (c && c.id && !memoryCampaigns.some(m => m.id === c.id)) {
        memoryCampaigns.push(c);
        added++;
      }
    }
    if (added > 0) {
      memoryCampaigns.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      saveLocalCampaignsDiskBackup();
    }
  }
  return res.json({ success: true, count: memoryCampaigns.length });
});

// 2. Détail d'une campagne (0 lecture Firestore)
router.get('/api/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // 1. Session active en cours
  const chunkSession = campaignSessions.get(id) || campaignSessions.get(Number(id)) || Array.from(campaignSessions.values()).find(s => campaignMatchesId(s.campaign, id));
  if (chunkSession) {
    return res.json(chunkSession.campaign);
  }
  const session = activePricingSessions.get(id) || Array.from(activePricingSessions.values()).find(s => String(s.campaign.id) === id || s.campaign.uuid === id);
  if (session) {
    return res.json(session.campaign);
  }

  // 2. Recherche en RAM locale du serveur (0 lecture Firestore requise)
  const mem = findCampaign(id);
  if (mem) {
    res.setHeader('X-Cache', 'HIT-RAM');
    return res.json(mem);
  }

  return res.status(404).json({ error: 'Campagne introuvable.' });
});

// 3. Lancement d'une campagne (Test rapide ou complète)
router.post('/api/campaigns/start', async (req: Request, res: Response) => {
  await ensureSynced();
  const {
    cityId,
    sampleLimit,
    triggerType,
    isTestSample,
    triggeredByUserId,
    triggeredByUserName,
    triggeredByUserRole,
    scopeMode,
    arrondissement,
    originArrondissement,
    destArrondissement,
    comment,
    timeSlotOverride,
    restartCampaignId
  } = req.body;
  if (!cityId) {
    return res.status(400).json({ error: 'cityId est obligatoire.' });
  }

  const city = cities.find(c => matchesCityId(c.id, cityId) || matchesCityId(c.uuid, cityId) || String(c.id) === String(cityId));
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }
  if (!city.active) {
    return res.status(400).json({ error: 'Impossible de lancer un pricing sur une ville inactive. Activez la ville d’abord.' });
  }

  let existingCampaign: PricingCampaign | undefined;
  if (restartCampaignId) {
    existingCampaign = findCampaign(restartCampaignId);
    if (existingCampaign) {
      existingCampaign.status = 'in_progress';
      existingCampaign.completedPairs = 0;
      existingCampaign.failedPairs = 0;
      existingCampaign.startedAt = new Date().toISOString();
      existingCampaign.finishedAt = undefined;
      existingCampaign.completedAt = undefined;
      existingCampaign.durationSeconds = undefined;
      if (comment) {
        existingCampaign.comment = comment.trim();
        existingCampaign.comments = comment.trim();
      }
      if (memoryCampaignTrips[existingCampaign.id]) memoryCampaignTrips[existingCampaign.id] = [];
      if (memoryCampaignCanonicalTrips[existingCampaign.id]) memoryCampaignCanonicalTrips[existingCampaign.id] = [];
      deleteCampaignTripsDiskBackup(existingCampaign.id);
    }
  }

  const activeNbs = neighborhoods.filter(n => (
    matchesCityId(n.cityId, cityId) ||
    matchesCityId(n.cityId, city.id) ||
    matchesCityId(n.cityId, city.uuid)
  ) && n.active);
  if (activeNbs.length < 2) {
    return res.status(400).json({ error: 'Au moins 2 quartiers actifs sont requis pour calculer des trajets.' });
  }

  let pairs: Array<{ origin: any; dest: any }> = [];

  if (scopeMode === 'airport') {
    // Tous les quartiers actifs ordinaires (non-aéroports) de la ville ciblent l'aéroport
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
      return res.status(400).json({ error: `Coordonnées de l'aéroport non configurées pour la ville de ${city.name}. Renseignez l'aéroport dans la gestion des villes.` });
    }
    const standardOrigins = activeNbs.filter(n => !isAirportNeighborhood(n) && String(n.id) !== String(airportDest.id));
    for (const origin of standardOrigins) {
      pairs.push({ origin, dest: airportDest });
    }
  } else {
    // EN DEHORS du mode explicite 'airport' : AUCUN quartier aéroportuaire n'est touché (ni origine, ni destination)
    const nonAirportNbs = activeNbs.filter(n => !isAirportNeighborhood(n));

    if (scopeMode === 'intra' && arrondissement) {
      const targetNbs = nonAirportNbs.filter(n => detectArrondissement(n) === arrondissement);
      const pool = targetNbs.length >= 2 ? targetNbs : nonAirportNbs;
      const MAX_CALLS_PER_NB = 5;

      for (let i = 0; i < pool.length; i++) {
        const origin = pool[i];
        let callsCount = 0;
        for (let j = 0; j < pool.length; j++) {
          if (i !== j && callsCount < MAX_CALLS_PER_NB) {
            pairs.push({ origin, dest: pool[j] });
            callsCount++;
          }
        }
      }
    } else if (scopeMode === 'inter' && originArrondissement && destArrondissement) {
      const originNbs = nonAirportNbs.filter(n => detectArrondissement(n) === originArrondissement);
      const destNbs = nonAirportNbs.filter(n => detectArrondissement(n) === destArrondissement);
      const poolOrigin = originNbs.length > 0 ? originNbs : nonAirportNbs.slice(0, Math.ceil(nonAirportNbs.length / 2));
      const poolDest = destNbs.length > 0 ? destNbs : nonAirportNbs.slice(Math.ceil(nonAirportNbs.length / 2));
      const MAX_CALLS_PER_NB = 5;

      for (const o of poolOrigin) {
        let callsCount = 0;
        for (const d of poolDest) {
          if (o.id !== d.id && callsCount < MAX_CALLS_PER_NB) {
            pairs.push({ origin: o, dest: d });
            callsCount++;
          }
        }
      }
      if (pairs.length > 300) {
        pairs = pairs.slice(0, 300);
      }
    } else {
      pairs = generatePricingPairs(nonAirportNbs, { sampleLimit });
    }

    // Filtrage absolu : double vérification de garantie anti-aéroport
    pairs = pairs.filter(p => !isAirportNeighborhood(p.origin) && !isAirportNeighborhood(p.dest));
  }

  const totalPossible = pairs.length;

  const limit = (sampleLimit && sampleLimit !== 'all') ? parseInt(String(sampleLimit), 10) : (isTestSample ? 25 : undefined);
  if (limit && limit > 0 && limit < pairs.length) {
    if (limit <= 50) {
      // Échantillonnage aléatoire équilibré pour un test représentatif sans aéroport
      const shuffled = [...pairs];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      pairs = shuffled.slice(0, limit);
    } else {
      pairs = pairs.slice(0, limit);
    }
  }

  const authorRole = triggeredByUserRole || (triggeredByUserId ? users.find(u => u.id === triggeredByUserId)?.role : undefined) || 'admin';
  const cleanTriggeredByName = triggeredByUserName && String(triggeredByUserName).trim()
    ? String(triggeredByUserName).trim()
    : (triggerType === 'scheduled' ? 'Planificateur Automatique' : 'Citrine Opérateur');

  const campaignSeqId = getNextSequence('campaigns');
  const campaignUuid = randomUUID();
  let computedCampaignType: 'arrondissement' | 'mt_arrondissement' | 'aeroport' | 'test_25' | 'all' = 'all';
  if (scopeMode === 'airport' || scopeMode === 'aeroport') {
    computedCampaignType = 'aeroport';
  } else if (limit === 25 || isTestSample) {
    computedCampaignType = 'test_25';
  } else if (scopeMode === 'inter' || (originArrondissement && destArrondissement)) {
    computedCampaignType = 'mt_arrondissement';
  } else if (scopeMode === 'intra' || arrondissement) {
    computedCampaignType = 'arrondissement';
  } else {
    computedCampaignType = 'all';
  }

  const campaign: PricingCampaign = existingCampaign || {
    id: campaignSeqId,
    uuid: campaignUuid,
    cityId: String(city.uuid || city.id),
    cityName: city.name,
    currency: city.currency,
    triggerType: triggerType || 'manual',
    triggeredByUserId: triggeredByUserId || 'admin_user',
    triggeredByUserName: cleanTriggeredByName,
    triggeredByUserRole: authorRole,
    status: 'in_progress',
    campaignType: computedCampaignType,
    totalPairs: pairs.length,
    completedPairs: 0,
    failedPairs: 0,
    startedAt: new Date().toISOString(),
    isTestSample: Boolean(isTestSample || (limit && limit <= 50)),
    sampleLimit: limit,
    totalPossiblePairs: totalPossible,
    comment: comment?.trim() || undefined,
    comments: comment?.trim() || undefined,
    timeSlotOverride: timeSlotOverride && timeSlotOverride !== 'auto' ? timeSlotOverride : undefined,
    scopeMode: scopeMode || (arrondissement ? 'intra' : 'city'),
    arrondissement: arrondissement || undefined,
    originArrondissement: originArrondissement || undefined,
    destArrondissement: destArrondissement || undefined,
    hasJamsCount: 0,
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Démarrage de la campagne ${computedCampaignType.toUpperCase()} (${pairs.length} trajets) par ${cleanTriggeredByName} (${authorRole}) pour ${city.name}.`
      }
    ]
  };

  if (existingCampaign) {
    existingCampaign.totalPairs = pairs.length;
    existingCampaign.totalPossiblePairs = totalPossible;
    existingCampaign.logs = existingCampaign.logs || [];
    existingCampaign.logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Relance de la campagne (${pairs.length} trajets) par ${cleanTriggeredByName}.`
    });
  }

  // Initialisation de la session de campagne
  await upsertCampaignInSupabase(campaign);
  const { totalChunks, totalPairs } = await initializeCampaignSession(campaign, city, pairs);
  saveLocalCampaignsDiskBackup();

  // Exécution automatique en arrière-plan sur le serveur pour garantir qu'un changement d'onglet ne perturbe pas la progression
  (async () => {
    try {
      const session = campaignSessions.get(campaign.id) || campaignSessions.get(Number(campaign.id));
      if (session) {
        const total = session.chunks.length;
        const collectedTrips: TripResult[] = [];
        const collectedCanonical: CanonicalTrip[] = [];
        const CONCURRENCY = Math.min(3, Math.max(1, total));
        let nextIdx = 1;

        const worker = async () => {
          while (nextIdx <= total) {
            if (session.campaign.status === 'cancelled') break;
            const currentIdx = nextIdx++;
            try {
              const chunkRes = await processCampaignChunk(String(campaign.id), currentIdx);
              if (chunkRes && chunkRes.success) {
                if (chunkRes.chunkTrips) collectedTrips.push(...chunkRes.chunkTrips);
                if (chunkRes.chunkCanonicalTrips) collectedCanonical.push(...chunkRes.chunkCanonicalTrips);
              }
            } catch (e) {
              console.warn(`[Server Campaign Background] Erreur lot ${currentIdx}:`, e);
            }
          }
        };

        await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

        if (session.campaign.status !== 'cancelled') {
          await finalizeCampaignExecution(String(campaign.id), collectedCanonical, collectedTrips);
          saveLocalCampaignsDiskBackup();
        }
      }
    } catch (err) {
      console.error('[Server Campaign Background] Erreur exécution arrière-plan:', err);
    }
  })();

  await recordHistory({
    action: 'start_campaign',
    eventType: 'campaign',
    title: `Démarrage de campagne: ${city.name}`,
    description: `${pairs.length} trajets prévus (${totalChunks} lots).`,
    performedByName: cleanTriggeredByName,
    performedBy: triggeredByUserId || 'admin'
  });

  return res.status(200).json({
    message: isTestSample ? `Test rapide initialisé (${pairs.length} trajets).` : `Campagne initialisée (${pairs.length} trajets).`,
    campaign,
    totalChunks,
    totalPairs
  });
});

// Traitement individuel d'un lot (Client-Driven Chunking)
router.post('/api/campaigns/:id/process-chunk', async (req: Request, res: Response) => {
  const { id } = req.params;
  const chunkIndex = parseInt(String(req.body.chunkIndex || req.query.chunkIndex || 1), 10);
  const fallbackMeta = req.body.fallbackMeta || {
    cityId: req.body.cityId,
    cityName: req.body.cityName,
    currency: req.body.currency,
    scopeMode: req.body.scopeMode,
    arrondissement: req.body.arrondissement,
    originArrondissement: req.body.originArrondissement,
    destArrondissement: req.body.destArrondissement,
    sampleLimit: req.body.sampleLimit
  };

  try {
    const result = await processCampaignChunk(id, chunkIndex, fallbackMeta);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erreur lors du traitement du lot.' });
  }
});

// Finalisation de la campagne
router.post('/api/campaigns/:id/finalize', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { canonicalTrips, trips } = req.body || {};

  try {
    const campaign = await finalizeCampaignExecution(id, canonicalTrips, trips);
    saveLocalCampaignsDiskBackup();
    return res.json({ success: true, campaign });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erreur lors de la finalisation.' });
  }
});

// Endpoint de suivi/step dynamique pour actualisation temps réel
router.post('/api/campaigns/:id/step', async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = activePricingSessions.get(id);
  if (session) {
    return res.json({ success: true, campaign: session.campaign });
  }

  let campaign = memoryCampaigns.find(c => c.id === id || c.uuid === id || String(c.id) === String(id));

  if (!campaign) {
    return res.status(404).json({ error: 'Campagne introuvable.' });
  }

  return res.json({ success: true, campaign });
});

// 4. Interruption manuelle d'urgence (100% découplée et indépendante de Firestore)
router.post('/api/campaigns/:id/cancel', (req: Request, res: Response) => {
  const { id } = req.params;
  const session = activePricingSessions.get(id);

  if (session) {
    session.cancelled = true;
    try { session.abortController.abort(); } catch {}
    session.campaign.status = 'cancelled';
    activePricingSessions.delete(id);
  }

  const camp = memoryCampaigns.find(c => c.id === id);
  if (camp) {
    camp.status = 'cancelled';
  }

  cancelChunkCampaignSession(id);
  saveLocalCampaignsDiskBackup();

  // Réponse immédiate en 0ms au client sans attendre Firestore !
  return res.json({ success: true, message: 'Arrêt immédiat de la campagne effectué en mémoire.' });
});

// 4b. Mise à jour du commentaire et/ou créneau d'une campagne
router.patch('/api/campaigns/:id/comment', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { comment, timeSlotOverride } = req.body;
  const trimmedComment = typeof comment === 'string' ? comment.trim() : undefined;

  // 1. Mettre à jour en mémoire
  const memCamp = findCampaign(id);
  if (memCamp) {
    if (trimmedComment !== undefined) {
      memCamp.comment = trimmedComment;
      memCamp.comments = trimmedComment;
    }
    if (timeSlotOverride !== undefined) {
      memCamp.timeSlotOverride = timeSlotOverride === 'auto' ? undefined : timeSlotOverride;
    }
    saveLocalCampaignsDiskBackup();

    // 2. Sauvegarde Supabase PostgreSQL
    try {
      const { pgPool } = await import('../db/supabase.js');
      await pgPool.query(
        'UPDATE public.campaigns SET comments = $1 WHERE uuid = $2 OR id::text = $2',
        [trimmedComment || null, memCamp.uuid || String(memCamp.id)]
      );
    } catch (e: any) {
      console.warn('[Supabase] Warning saving campaign comment:', e.message);
    }
  }

  await recordHistory({
    action: 'update_campaign_comment',
    eventType: 'campaign',
    title: `Commentaire / Créneau campagne mis à jour`,
    description: trimmedComment ? `Note: "${trimmedComment.slice(0, 80)}"` : 'Mise à jour du contexte de la campagne',
    performedByName: 'Admin',
    metadata: { campaignId: id, timeSlotOverride }
  }).catch(() => {});

  return res.json({ success: true, id, comment: trimmedComment, timeSlotOverride, campaign: memCamp });
});

// 5. Suppression globale
router.delete('/api/campaigns', async (_req: Request, res: Response) => {
  memoryCampaigns.length = 0;
  for (const id of Object.keys(memoryCampaignTrips)) {
    delete memoryCampaignTrips[id];
  }
  for (const id of Object.keys(memoryCampaignCanonicalTrips)) {
    delete memoryCampaignCanonicalTrips[id];
  }
  campaignSessions.clear();
  activePricingSessions.clear();
  deleteAllCampaignTripsDiskBackup();
  saveLocalCampaignsDiskBackup();
  clearAllShortages();

  // Nettoyage Supabase PostgreSQL (suppression globale)
  try {
    const { pgPool } = await import('../db/supabase.js');
    await pgPool.query('DELETE FROM public.trips');
    await pgPool.query('DELETE FROM public.shortages');
    await pgPool.query('DELETE FROM public.campaign_results');
    await pgPool.query('DELETE FROM public.campaigns');
  } catch (err: any) {
    console.warn('[Supabase] Warning global delete:', err.message);
  }

  await recordHistory({
    action: 'delete_all_campaigns',
    eventType: 'campaign',
    title: 'Toutes les campagnes supprimées',
    description: 'Suppression globale de toutes les campagnes et de leurs résultats.'
  });

  return res.json({ success: true, message: 'Toutes les campagnes ont été supprimées.' });
});

// 6. Suppression unique
router.delete('/api/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const target = findCampaign(id);
  const targetId = target ? target.id : id;
  const targetUuid = target?.uuid;

  const remaining = memoryCampaigns.filter(c => !campaignMatchesId(c, id) && !campaignMatchesId(c, targetUuid || targetId));
  memoryCampaigns.splice(0, memoryCampaigns.length, ...remaining);

  delete memoryCampaignTrips[String(targetId)];
  if (targetUuid) delete memoryCampaignTrips[targetUuid];
  delete memoryCampaignCanonicalTrips[String(targetId)];
  if (targetUuid) delete memoryCampaignCanonicalTrips[targetUuid];

  for (const key of Array.from(campaignSessions.keys())) {
    const session = campaignSessions.get(key);
    if (session && (campaignMatchesId(session.campaign, id) || campaignMatchesId(session.campaign, targetUuid || targetId))) {
      campaignSessions.delete(key);
    }
  }

  for (const key of Array.from(activePricingSessions.keys())) {
    const session = activePricingSessions.get(key);
    if (session && (campaignMatchesId(session.campaign, id) || campaignMatchesId(session.campaign, targetUuid || targetId))) {
      activePricingSessions.delete(key);
    }
  }

  deleteCampaignTripsDiskBackup(targetId);
  saveLocalCampaignsDiskBackup();
  deleteShortagesForCampaign(targetId);
  if (targetUuid) deleteShortagesForCampaign(targetUuid);

  // Nettoyage de l'historique en mémoire locale
  deleteHistoryForCampaign(String(targetId)).catch(() => {});
  if (targetUuid) deleteHistoryForCampaign(targetUuid).catch(() => {});

  // Nettoyage Supabase PostgreSQL (supprime campagnes, campaign_results, trips et shortages en cascade)
  deleteCampaignInSupabase(targetUuid || String(targetId)).catch(() => {});

  return res.json({ success: true, message: 'Campagne, résultats et historiques associés supprimés avec succès.' });
});

// 7. Résultats des trajets (100% Mémoire RAM & Disque local - 0 lecture Firestore)
router.get('/api/campaigns/:id/results', async (req: Request, res: Response) => {
  const { id } = req.params;
  const camp = findCampaign(id);
  const targetId = camp ? camp.id : id;
  const targetUuid = camp?.uuid;

  // 1. Session active en cours (campaignSessions ou activePricingSessions)
  const chunkSession = campaignSessions.get(id) || campaignSessions.get(Number(id)) || (targetId ? campaignSessions.get(targetId) : undefined) || (targetId ? campaignSessions.get(Number(targetId)) : undefined) || (targetUuid ? campaignSessions.get(targetUuid) : undefined) || Array.from(campaignSessions.values()).find(s => campaignMatchesId(s.campaign, id));
  if (chunkSession && chunkSession.trips.length > 0) {
    res.setHeader('X-Cache', 'HIT-CHUNK-SESSION');
    return res.json(chunkSession.trips);
  }

  const session = activePricingSessions.get(String(targetId)) || (targetUuid ? activePricingSessions.get(targetUuid) : undefined);
  if (session && session.trips.length > 0) {
    res.setHeader('X-Cache', 'HIT-SESSION');
    return res.json(session.trips);
  }

  // 2. Cache mémoire RAM serveur instantané (2ms, 0 lecture Firestore)
  const ramTrips = memoryCampaignTrips[String(targetId)] || memoryCampaignTrips[String(id)] || (targetUuid ? memoryCampaignTrips[targetUuid] : undefined);
  if (ramTrips && ramTrips.length > 0) {
    res.setHeader('X-Cache', 'HIT-RAM');
    return res.json(ramTrips);
  }

  // 3. Cache disque local serveur persistant (survit aux redémarrages et quotas, 0 lecture Firestore)
  const diskTrips = loadCampaignTripsDiskBackup(targetId) || loadCampaignTripsDiskBackup(id) || (targetUuid ? loadCampaignTripsDiskBackup(targetUuid) : null);
  if (diskTrips && diskTrips.length > 0) {
    res.setHeader('X-Cache', 'HIT-DISK');
    return res.json(diskTrips);
  }

  // 4. Supabase PostgreSQL
  try {
    const sbTrips = await fetchCampaignResultsFromSupabase(targetUuid || String(targetId));
    if (sbTrips && sbTrips.length > 0) {
      res.setHeader('X-Cache', 'HIT-SUPABASE');
      return res.json(sbTrips);
    }
  } catch {}

  return res.json([]);
});

// 7b. Route de synchronisation bidirectionnelle des trajets depuis le client (IndexedDB -> Disque Serveur)
router.post('/api/campaigns/:id/sync-trips', (req: Request, res: Response) => {
  const { id } = req.params;
  const { trips } = req.body;

  if (Array.isArray(trips) && trips.length > 0) {
    memoryCampaignTrips[id] = trips;
    saveCampaignTripsDiskBackup(id, trips);
    console.log(`[Sync Trips] ${trips.length} trajets synchronisés depuis le client pour la campagne ${id}.`);
    return res.json({ success: true, count: trips.length });
  }

  return res.status(400).json({ error: 'Format de trajets invalide.' });
});

// 8. Endpoint Téléchargement JSON Canonique Ultra-Léger
router.get('/api/campaigns/:id/canonical-json', async (req: Request, res: Response) => {
  const { id } = req.params;

  let canonicalTrips: CanonicalTrip[] = [];

  const session = campaignSessions.get(id) || activePricingSessions.get(id);
  if (session && session.canonicalTrips && session.canonicalTrips.length > 0) {
    canonicalTrips = session.canonicalTrips;
  } else if (memoryCampaignCanonicalTrips[id] && memoryCampaignCanonicalTrips[id].length > 0) {
    canonicalTrips = memoryCampaignCanonicalTrips[id];
  } else {
    canonicalTrips = loadCanonicalTripsDiskBackup(id) || [];
  }

  const campaign = findCampaign(id);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="pricing_canonical_${id}.json"`);

  return res.json({
    format: 'citrine.vtc.canonical.v1',
    campaignId: id,
    cityName: campaign?.cityName || 'Douala',
    exportedAt: new Date().toISOString(),
    totalTrips: canonicalTrips.length,
    trips: canonicalTrips
  });
});

// 9. Export CSV / Excel
router.get('/api/campaigns/:id/export', async (req: Request, res: Response) => {
  const { id } = req.params;
  let canonicalTrips: CanonicalTrip[] = [];

  const session = campaignSessions.get(id) || activePricingSessions.get(id);
  if (session && session.canonicalTrips && session.canonicalTrips.length > 0) {
    canonicalTrips = session.canonicalTrips;
  } else if (memoryCampaignCanonicalTrips[id] && memoryCampaignCanonicalTrips[id].length > 0) {
    canonicalTrips = memoryCampaignCanonicalTrips[id];
  } else {
    canonicalTrips = loadCanonicalTripsDiskBackup(id) || [];
  }

  const campaign = findCampaign(id);

  const cityName = campaign?.cityName || 'Douala';

  const headers = [
    'ID Trajet',
    'Ville',
    'Départ (Quartier)',
    'Arrivée (Quartier)',
    'Distance (km)',
    'Durée (min)',
    'Yango Éco (FCFA)',
    'Yango Confort (FCFA)',
    'HeroCab Éco (FCFA)',
    'HeroCab Confort (FCFA)',
    'Trip Master Éco (FCFA)',
    'Trip Master Confort (FCFA)',
    'Moins Cher',
    'Date Relevé'
  ];

  const rows = canonicalTrips.map(t => [
    `"${t.id}"`,
    `"${cityName}"`,
    `"${t.origin.replace(/"/g, '""')}"`,
    `"${t.destination.replace(/"/g, '""')}"`,
    t.distanceKm,
    t.durationMin,
    t.prices.yango?.eco || '',
    t.prices.yango?.confort || '',
    t.prices.heroCab?.eco || '',
    t.prices.heroCab?.confort || '',
    t.prices.tripMaster?.eco || '',
    t.prices.tripMaster?.confort || '',
    `"${t.cheapest?.eco || ''}"`,
    `"${t.createdAt || ''}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pricing_${cityName.toLowerCase()}_${canonicalTrips.length}_trajets.csv"`);
  return res.send(csvContent);
});

// 10. Endpoint déclenché par pg_cron de Supabase (ou webhook externe) - Pricing Général (8h, 13h, 18h)
router.all('/api/cron/trigger-pricing', async (req: Request, res: Response) => {
  try {
    const { cityId, mode } = req.method === 'POST' ? req.body : req.query;
    console.log('[Cron Route] Requête reçue pour /api/cron/trigger-pricing:', { cityId, mode, method: req.method });

    if (mode === 'airport' || mode === 'aeroport') {
      const result = await runAutomatedAirportCampaign(cityId, 'Cron Supabase Aéroport (20h, 23h, 2h)');
      return res.json({
        success: true,
        type: 'aeroport',
        message: 'Tarification automatique Aéroport initiée avec succès en arrière-plan (créneaux 20h, 23h, 2h).',
        campaignId: result.campaignId,
        totalPairs: result.totalPairs,
        schedule: '20h, 23h, 2h',
        triggeredAt: new Date().toISOString()
      });
    }

    const result = await runAutomatedServerCampaign(cityId, 'Cron Supabase Pricing (8h, 13h, 18h)');
    return res.json({
      success: true,
      type: 'pricing_general',
      message: 'Tarification automatique générale initiée avec succès en arrière-plan (créneaux 8h, 13h, 18h).',
      campaignId: result.campaignId,
      totalPairs: result.totalPairs,
      schedule: '8h, 13h, 18h',
      triggeredAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[Cron Route Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Endpoint dédié pour les destinations Aéroport uniquement (20h, 23h, 2h)
router.all(['/api/cron/trigger-airport-pricing', '/api/cron/trigger-airport'], async (req: Request, res: Response) => {
  try {
    const { cityId } = req.method === 'POST' ? req.body : req.query;
    console.log('[Cron Airport Route] Requête reçue pour relevé aéroport:', { cityId, method: req.method });

    const result = await runAutomatedAirportCampaign(cityId, 'Cron Supabase Aéroport (20h, 23h, 2h)');
    return res.json({
      success: true,
      type: 'aeroport',
      message: 'Tarification automatique Aéroport initiée avec succès en arrière-plan (créneaux 20h, 23h, 2h).',
      campaignId: result.campaignId,
      totalPairs: result.totalPairs,
      schedule: '20h, 23h, 2h',
      triggeredAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[Cron Airport Route Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Métadonnées et statut des crons programmés (8h, 13h, 18h & 20h, 23h, 2h)
router.get('/api/cron/status', async (_req: Request, res: Response) => {
  return res.json({
    status: 'active',
    crons: [
      {
        id: 'pricing_general',
        name: 'Tarification Générale (Pricing)',
        schedule: '8h, 13h, 18h',
        cronExpression: '0 8,13,18 * * *',
        slots: ['08:00 UTC', '13:00 UTC', '18:00 UTC'],
        description: 'Relevé complet multi-classes de la matrice de tous les quartiers actifs intra-ville.',
        scope: 'Tous les quartiers',
        endpoint: '/api/cron/trigger-pricing'
      },
      {
        id: 'airport_destinations',
        name: 'Destinations Aéroport Uniquement',
        schedule: '20h, 23h, 2h',
        cronExpression: '0 20,23,2 * * *',
        slots: ['20:00 UTC', '23:00 UTC', '02:00 UTC'],
        description: 'Relevé nocturne spécialisé reliant chaque quartier actif exclusivement à l’Aéroport.',
        scope: 'Quartiers vers Aéroport',
        endpoint: '/api/cron/trigger-airport-pricing'
      }
    ]
  });
});

export default router;
