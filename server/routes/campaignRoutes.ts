import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  cities,
  neighborhoods,
  users,
  memoryCampaigns,
  setMemoryCampaigns,
  memoryCampaignTrips,
  memoryCampaignCanonicalTrips,
  activePricingSessions,
  recordHistory,
  deleteHistoryForCampaign,
  ensureSynced,
  saveLocalCampaignsDiskBackup,
  saveCampaignTripsDiskBackup,
  loadCampaignTripsDiskBackup,
  deleteCampaignTripsDiskBackup,
  deleteAllCampaignTripsDiskBackup
} from '../db/memoryStore.js';
import { PricingCampaign, CanonicalTrip, TripResult } from '../types.js';
import {
  initializeCampaignSession,
  processCampaignChunk,
  finalizeCampaignExecution,
  cancelChunkCampaignSession,
  cleanNeighborhoodName,
  campaignSessions,
  cancelledCampaignIds,
  runAutomatedServerCampaign,
  runAutomatedAirportCampaign
} from '../services/campaignEngine.js';
import { generateBenchmarkPairs, calculatePossibleBenchmarkPairsCount, detectArrondissement } from '../../src/utils/routeMatrix.js';
import { getNextSequence } from '../db/counters.js';
import { loadCanonicalCampaignResults, deleteCampaignFromSupabase, deleteAllCampaignsFromSupabase } from '../db/supabase.js';

const router = Router();

export function findCampaign(idOrUuid: string | number): PricingCampaign | undefined {
  const str = String(idOrUuid);
  return memoryCampaigns.find(c => String(c.id) === str || c.uuid === str);
}

// 1. Liste des 25 dernières campagnes (Servie à 100% depuis la mémoire RAM et persistance locale)
router.get('/api/campaigns', async (_req: Request, res: Response) => {
  let list: PricingCampaign[] = [...memoryCampaigns];

  // Fusion avec les campagnes actives en mémoire (Sessions en temps réel)
  for (const [id, session] of campaignSessions.entries()) {
    const sUuid = session.campaign.uuid;
    const idx = list.findIndex(c => String(c.id) === String(id) || (sUuid && c.uuid === sUuid) || c.uuid === String(id));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...session.campaign };
    } else {
      list.unshift({ ...session.campaign });
    }
  }
  for (const [id, session] of activePricingSessions.entries()) {
    const sUuid = session.campaign.uuid;
    const idx = list.findIndex(c => String(c.id) === String(id) || (sUuid && c.uuid === sUuid) || c.uuid === String(id));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...session.campaign };
    } else {
      list.unshift({ ...session.campaign });
    }
  }

  // Dédoublonnage strict par ID et UUID
  const seenKeys = new Set<string>();
  const deduplicatedList: PricingCampaign[] = [];
  for (const camp of list) {
    const key = camp.uuid || String(camp.id);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduplicatedList.push(camp);
    }
  }
  list = deduplicatedList;

  list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  // Nettoyage des statuts pour les campagnes terminées
  list = list.map(c => {
    if (c.status === 'in_progress') {
      const isActuallyFinished = c.completedPairs && c.totalPairs && c.completedPairs >= c.totalPairs;
      if (isActuallyFinished) {
        return { ...c, status: 'completed' };
      }
    }
    return c;
  });

  // Strictement limité aux 10 dernières campagnes
  const final10 = list.slice(0, 10);
  res.setHeader('X-Cache', 'HIT-RAM-STRICT-10');
  return res.json(final10);
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

// 2. Détail d'une campagne
router.get('/api/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const mem = findCampaign(id);
  const uuid = mem?.uuid || id;

  // 1. Session active en cours
  const chunkSession = campaignSessions.get(uuid) || campaignSessions.get(id);
  if (chunkSession) {
    return res.json(chunkSession.campaign);
  }
  const session = activePricingSessions.get(uuid) || activePricingSessions.get(id);
  if (session) {
    return res.json(session.campaign);
  }

  // 2. Recherche en RAM locale du serveur (10 dernières campagnes en mémoire)
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
    timeSlotOverride
  } = req.body;
  if (!cityId) {
    return res.status(400).json({ error: 'cityId est obligatoire.' });
  }

  const city = cities.find(c => String(c.id) === String(cityId) || c.uuid === String(cityId));
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }
  if (!city.active) {
    return res.status(400).json({ error: 'Impossible de lancer un pricing sur une ville inactive. Activez la ville d’abord.' });
  }

  const cId = String(city.id);
  const cUuid = city.uuid;
  const cName = city.name ? city.name.toLowerCase().trim() : '';

  const activeNbs = neighborhoods.filter(n => {
    if (!n.active) return false;
    if (n.cityId === cUuid || String(n.cityId) === cId) return true;
    if (cName && (n.ville || n.cityName || '').toLowerCase().trim().includes(cName)) return true;
    return false;
  });

  if (activeNbs.length < 2) {
    return res.status(400).json({ error: 'Au moins 2 quartiers actifs sont requis pour calculer des trajets.' });
  }

  let pairs: Array<{ origin: any; dest: any }> = [];

  if (scopeMode === 'intra' && arrondissement) {
    const targetNbs = activeNbs.filter(n => detectArrondissement(n) === arrondissement);
    const pool = targetNbs.length >= 2 ? targetNbs : activeNbs;
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
    const originNbs = activeNbs.filter(n => detectArrondissement(n) === originArrondissement);
    const destNbs = activeNbs.filter(n => detectArrondissement(n) === destArrondissement);
    const poolOrigin = originNbs.length > 0 ? originNbs : activeNbs.slice(0, Math.ceil(activeNbs.length / 2));
    const poolDest = destNbs.length > 0 ? destNbs : activeNbs.slice(Math.ceil(activeNbs.length / 2));
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
    pairs = generateBenchmarkPairs(activeNbs);
  }

  const totalPossible = pairs.length;

  const limit = (sampleLimit && sampleLimit !== 'all') ? parseInt(String(sampleLimit), 10) : (isTestSample ? 25 : undefined);
  if (limit && limit > 0 && limit < pairs.length) {
    pairs = pairs.slice(0, limit);
  }

  const authorRole = triggeredByUserRole || (triggeredByUserId ? users.find(u => u.id === triggeredByUserId)?.role : undefined) || 'admin';
  const cleanTriggeredByName = triggeredByUserName && String(triggeredByUserName).trim()
    ? String(triggeredByUserName).trim()
    : (triggerType === 'scheduled' ? 'Planificateur Automatique' : 'Citrine Opérateur');

  const campaignUuid = randomUUID();
  const campaignNumericId = getNextSequence('campaigns');
  const campaign: PricingCampaign = {
    id: campaignNumericId,
    uuid: campaignUuid,
    cityId: city.uuid || String(city.id),
    cityName: city.name,
    currency: city.currency,
    triggerType: triggerType || 'manual',
    triggeredByUserId: triggeredByUserId || 'admin_user',
    triggeredByUserName: cleanTriggeredByName,
    triggeredByUserRole: authorRole,
    status: 'in_progress',
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
        message: `Démarrage de la campagne ${isTestSample ? 'Test ' : ''}(${pairs.length} trajets) par ${cleanTriggeredByName} (${authorRole}) pour ${city.name}.`
      }
    ]
  };

  // Initialisation de la session de campagne
  const { totalChunks, totalPairs } = await initializeCampaignSession(campaign, city, pairs);
  saveLocalCampaignsDiskBackup();

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

// Alias direct /api/campaigns/:id/chunk/:chunkIndex
router.post('/api/campaigns/:id/chunk/:chunkIndex', async (req: Request, res: Response) => {
  const { id, chunkIndex } = req.params;
  const cIdx = parseInt(String(chunkIndex || 1), 10);
  const fallbackMeta = req.body.fallbackMeta || req.body;
  try {
    const result = await processCampaignChunk(id, cIdx, fallbackMeta);
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

  let campaign = memoryCampaigns.find(c => c.id === id);

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
  const campUuid = memCamp?.uuid || id;
  if (memCamp) {
    if (trimmedComment !== undefined) {
      memCamp.comment = trimmedComment;
      memCamp.comments = trimmedComment;
    }
    if (timeSlotOverride !== undefined) {
      memCamp.timeSlotOverride = timeSlotOverride === 'auto' ? undefined : timeSlotOverride;
    }
  }

  // 2. Sauvegarde disque local
  saveLocalCampaignsDiskBackup();

  // 3. Sauvegarde Supabase / stockage local
  try {
    const updatePayload: Record<string, any> = {};
    if (trimmedComment !== undefined) {
      updatePayload.comment = trimmedComment;
      updatePayload.comments = trimmedComment;
    }
    if (timeSlotOverride !== undefined) {
      updatePayload.timeSlotOverride = timeSlotOverride === 'auto' ? null : timeSlotOverride;
    }
    // Mise à jour locale déjà effectuée sur memCamp
  } catch (e: any) {
    console.warn('[Storage] Warning updating campaign comment:', e.message);
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
  const campsToDelete = [...memoryCampaigns];
  memoryCampaigns.length = 0;
  for (const cid of Object.keys(memoryCampaignTrips)) {
    delete memoryCampaignTrips[cid];
  }
  for (const cid of Object.keys(memoryCampaignCanonicalTrips)) {
    delete memoryCampaignCanonicalTrips[cid];
  }
  campaignSessions.clear();
  activePricingSessions.clear();
  deleteAllCampaignTripsDiskBackup();
  saveLocalCampaignsDiskBackup();
  deleteAllCampaignsFromSupabase().catch(() => {});

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
  const targetCamp = findCampaign(id);
  const campUuid = targetCamp?.uuid || id;
  const campNumId = targetCamp?.id ? String(targetCamp.id) : null;

  // 1. Interrompre immédiatement la boucle de calcul d'arrière-plan si elle est en cours
  cancelChunkCampaignSession(id);
  cancelledCampaignIds.add(String(id));
  if (campUuid) cancelledCampaignIds.add(campUuid);
  if (campNumId) cancelledCampaignIds.add(campNumId);

  const idx = memoryCampaigns.findIndex(c => String(c.id) === String(id) || c.uuid === id);
  if (idx >= 0) memoryCampaigns.splice(idx, 1);

  delete memoryCampaignTrips[campUuid];
  delete memoryCampaignCanonicalTrips[campUuid];
  if (campNumId) {
    delete memoryCampaignTrips[campNumId];
    delete memoryCampaignCanonicalTrips[campNumId];
  }

  campaignSessions.delete(campUuid);
  activePricingSessions.delete(campUuid);
  if (campNumId) {
    campaignSessions.delete(campNumId);
    activePricingSessions.delete(campNumId);
  }

  deleteCampaignTripsDiskBackup(campUuid);
  if (campNumId) deleteCampaignTripsDiskBackup(campNumId);
  saveLocalCampaignsDiskBackup();

  // Suppression en base Supabase (par UUID et ID numérique)
  await deleteCampaignFromSupabase(campUuid).catch(() => {});
  if (campNumId) {
    await deleteCampaignFromSupabase(campNumId).catch(() => {});
  }

  // Nettoyage de l'historique en mémoire locale
  deleteHistoryForCampaign(campUuid).catch(() => {});

  return res.json({ success: true, message: 'Campagne, résultats et historiques associés supprimés avec succès.' });
});

// 7. Résultats des trajets (Exploite notre cache RAM, disque local et JSON canonique pour garantir 0 lecture Firestore)
router.get('/api/campaigns/:id/results', async (req: Request, res: Response) => {
  const { id } = req.params;
  const targetCamp = findCampaign(id);
  const campUuid = targetCamp?.uuid || id;
  const campNumId = targetCamp?.id ? String(targetCamp.id) : null;

  // 1. Session active en cours
  const session = activePricingSessions.get(campUuid) || (campNumId ? activePricingSessions.get(campNumId) : undefined);
  if (session && session.trips.length > 0) {
    res.setHeader('X-Cache', 'HIT-SESSION');
    return res.json(session.trips);
  }

  // 2. Cache mémoire RAM serveur instantané (2ms, 0 lecture Firestore)
  if (memoryCampaignTrips[campUuid] && memoryCampaignTrips[campUuid].length > 0) {
    res.setHeader('X-Cache', 'HIT-RAM');
    return res.json(memoryCampaignTrips[campUuid]);
  }
  if (campNumId && memoryCampaignTrips[campNumId] && memoryCampaignTrips[campNumId].length > 0) {
    res.setHeader('X-Cache', 'HIT-RAM');
    return res.json(memoryCampaignTrips[campNumId]);
  }

  // 3. Cache disque local serveur persistant (survit aux redémarrages et quotas)
  const diskTrips = loadCampaignTripsDiskBackup(campUuid) || (campNumId ? loadCampaignTripsDiskBackup(campNumId) : null);
  if (diskTrips && diskTrips.length > 0) {
    res.setHeader('X-Cache', 'HIT-DISK');
    return res.json(diskTrips);
  }

  // 4. Lecture du JSON canonique depuis le stockage persistant
  const canonicalTrips = await loadCanonicalCampaignResults(campUuid);
  if (canonicalTrips.length > 0) {
    const cleanTrips = canonicalTrips.map(t => {
      const pYango = t.prices?.yango || { eco: null, confort: null, confortPlus: null, moto: null };
      return {
        id: t.id,
        uuid: t.uuid,
        campaignId: campUuid,
        origin: t.origin,
        destination: t.destination,
        distanceKm: t.distanceKm,
        durationMinutes: t.durationMin,
        jams: Boolean(t.jams),
        yangoUnavailable: Boolean(t.yangoUnavailable),
        yangoWaitingMinutes: t.yangoWaitingMinutes,
        yangoUnavailableClasses: t.yangoUnavailableClasses,
        prices: {
          ...t.prices,
          yango: {
            ...pYango,
            jams: pYango.jams !== undefined ? pYango.jams : Boolean(t.jams),
            yangoUnavailable: pYango.yangoUnavailable !== undefined ? pYango.yangoUnavailable : Boolean(t.yangoUnavailable)
          }
        },
        cheapest: t.cheapest,
        status: t.status,
        createdAt: t.createdAt
      };
    }) as unknown as TripResult[];

    memoryCampaignTrips[campUuid] = cleanTrips;
    saveCampaignTripsDiskBackup(campUuid, cleanTrips, canonicalTrips);
    res.setHeader('X-Cache', 'HIT-STORAGE');
    return res.json(cleanTrips);
  }

  // Si aucun trajet n'est encore enregistré ou si la campagne débute, renvoyer un tableau vide [] avec statut 200 (pas d'erreur 404)
  return res.json([]);
});

// 7b. Route de synchronisation bidirectionnelle des trajets depuis le client (IndexedDB -> Disque Serveur)
router.post('/api/campaigns/:id/sync-trips', (req: Request, res: Response) => {
  const { id } = req.params;
  const { trips } = req.body;
  const targetCamp = findCampaign(id);
  const campUuid = targetCamp?.uuid || id;

  if (Array.isArray(trips) && trips.length > 0) {
    memoryCampaignTrips[campUuid] = trips;
    saveCampaignTripsDiskBackup(campUuid, trips);
    console.log(`[Sync Trips] ${trips.length} trajets synchronisés depuis le client pour la campagne ${campUuid}.`);
    return res.json({ success: true, count: trips.length });
  }

  return res.status(400).json({ error: 'Format de trajets invalide.' });
});

// 8. Endpoint Téléchargement JSON Canonique Ultra-Léger
router.get('/api/campaigns/:id/canonical-json', async (req: Request, res: Response) => {
  const { id } = req.params;
  const targetCamp = findCampaign(id);
  const campUuid = targetCamp?.uuid || id;

  let canonicalTrips: CanonicalTrip[] = [];

  const session = activePricingSessions.get(campUuid);
  if (session) {
    canonicalTrips = session.canonicalTrips;
  } else if (memoryCampaignCanonicalTrips[campUuid]) {
    canonicalTrips = memoryCampaignCanonicalTrips[campUuid];
  } else {
    canonicalTrips = await loadCanonicalCampaignResults(campUuid);
  }

  let campaign = targetCamp || memoryCampaigns.find(c => c.uuid === campUuid || String(c.id) === String(id));

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="pricing_canonical_${campUuid}.json"`);

  return res.json({
    format: 'citrine.vtc.canonical.v1',
    campaignId: campUuid,
    campaignNumber: campaign?.id,
    cityName: campaign?.cityName || 'Douala',
    exportedAt: new Date().toISOString(),
    totalTrips: canonicalTrips.length,
    trips: canonicalTrips
  });
});

// 9. Export CSV / Excel
router.get('/api/campaigns/:id/export', async (req: Request, res: Response) => {
  const { id } = req.params;
  const targetCamp = findCampaign(id);
  const campUuid = targetCamp?.uuid || id;
  const canonicalTrips = await loadCanonicalCampaignResults(campUuid);

  let campaign = targetCamp || memoryCampaigns.find(c => c.uuid === campUuid || String(c.id) === String(id));
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

// 10. Endpoint déclenché par pg_cron de Supabase (pour la campagne aéroport de 22h)
router.all('/api/cron/trigger-airport', async (req: Request, res: Response) => {
  try {
    const { cityId } = req.method === 'POST' ? req.body : req.query;
    console.log('[Cron Airport Route] Requête reçue pour /api/cron/trigger-airport:', { cityId, method: req.method });

    const result = await runAutomatedAirportCampaign(cityId, 'Cron Aéroport Supabase (pg_cron)');
    return res.json({
      success: true,
      message: 'Tarification aéroport automatique initiée avec succès en arrière-plan.',
      campaignId: result.campaignId,
      totalPairs: result.totalPairs,
      triggeredAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[Cron Airport Route Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
