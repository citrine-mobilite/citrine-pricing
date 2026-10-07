import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, writeBatch, query, orderBy, limit } from 'firebase/firestore';
import {
  db,
  cleanFirestoreDoc,
  safeFirestoreWrite,
  loadCanonicalCampaignResults,
  initCanonicalCampaignResults,
  deleteCanonicalCampaign,
  isFirestoreQuotaExceeded,
  isQuotaExceededError,
  flagFirestoreQuotaExceeded
} from '../db/firestore.js';
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
  saveCampaignTripsDiskBackup,
  loadCampaignTripsDiskBackup
} from '../db/memoryStore.js';
import { PricingCampaign, CanonicalTrip, TripResult } from '../types.js';
import {
  initializeCampaignSession,
  processCampaignChunk,
  finalizeCampaignExecution,
  cancelChunkCampaignSession,
  cleanNeighborhoodName,
  campaignSessions
} from '../services/campaignEngine.js';
import { generateBenchmarkPairs, calculatePossibleBenchmarkPairsCount, detectArrondissement } from '../../src/utils/routeMatrix.js';

const router = Router();

// 1. Liste des campagnes (avec cache RAM serveur TTL 60s - 0 lecture Firestore redondante)
let lastCampaignsFirestoreFetch = 0;
let cachedFirestoreCampaigns: PricingCampaign[] = [];

router.get('/api/campaigns', async (req: Request, res: Response) => {
  const forceRefresh = req.query.forceRefresh === 'true';
  const now = Date.now();
  let list: PricingCampaign[] = [];

  if (db && !isFirestoreQuotaExceeded() && (cachedFirestoreCampaigns.length === 0 || forceRefresh || now - lastCampaignsFirestoreFetch > 60000)) {
    try {
      // On limite la synchronisation Firestore aux 25 campagnes les plus récentes pour préserver au maximum les quotas de lecture !
      const campaignsQuery = query(
        collection(db, 'campaigns'),
        orderBy('startedAt', 'desc'),
        limit(25)
      );
      const snap = await getDocs(campaignsQuery);
      if (!snap.empty) {
        cachedFirestoreCampaigns = snap.docs.map(d => ({ id: d.id, ...d.data() } as PricingCampaign));
        lastCampaignsFirestoreFetch = now;

        // Écrire agressivement les campagnes de Firestore sur le disque local persistant
        let diskUpdated = false;
        for (const camp of cachedFirestoreCampaigns) {
          const idx = memoryCampaigns.findIndex(m => m.id === camp.id);
          if (idx < 0) {
            memoryCampaigns.push(camp);
            diskUpdated = true;
          } else {
            // Mettre à jour si les valeurs Firestore sont plus complètes
            if (JSON.stringify(memoryCampaigns[idx]) !== JSON.stringify(camp)) {
              memoryCampaigns[idx] = { ...memoryCampaigns[idx], ...camp };
              diskUpdated = true;
            }
          }
        }
        if (diskUpdated) {
          saveLocalCampaignsDiskBackup();
        }
      }
    } catch (e: any) {
      lastCampaignsFirestoreFetch = now + 5 * 60 * 1000;
      if (isQuotaExceededError(e)) {
        flagFirestoreQuotaExceeded(e);
      } else {
        console.warn('[Firestore] get campaigns error:', e.message);
      }
    }
  }

  list = [...cachedFirestoreCampaigns];

  // Fusion avec memoryCampaigns (l'état RAM serveur plus récent l'emporte sur un snapshot Firestore retardataire)
  for (const memCamp of memoryCampaigns) {
    const idx = list.findIndex(c => c.id === memCamp.id);
    if (idx >= 0) {
      // Si la version mémoire est completed ou plus avancée en completedPairs, elle prime
      if (memCamp.status === 'completed' || (memCamp.completedPairs || 0) >= (list[idx].completedPairs || 0)) {
        list[idx] = { ...list[idx], ...memCamp };
      }
    } else {
      list.unshift({ ...memCamp });
    }
  }

  // Fusion avec les campagnes actives en mémoire (Chunking sessions & Worker sessions)
  for (const [id, session] of campaignSessions.entries()) {
    const idx = list.findIndex(c => c.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...session.campaign };
    } else {
      list.unshift({ ...session.campaign });
    }
  }
  for (const [id, session] of activePricingSessions.entries()) {
    const idx = list.findIndex(c => c.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...session.campaign };
    } else {
      list.unshift({ ...session.campaign });
    }
  }

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

// 2. Détail d'une campagne
router.get('/api/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // 1. Session active en cours
  const chunkSession = campaignSessions.get(id);
  if (chunkSession) {
    return res.json(chunkSession.campaign);
  }
  const session = activePricingSessions.get(id);
  if (session) {
    return res.json(session.campaign);
  }

  // 2. Recherche en RAM locale du serveur (memoryCampaigns et cachedFirestoreCampaigns)
  const mem = memoryCampaigns.find(c => c.id === id);
  if (mem) {
    res.setHeader('X-Cache', 'HIT-RAM');
    return res.json(mem);
  }

  const cached = cachedFirestoreCampaigns.find(c => c.id === id);
  if (cached) {
    res.setHeader('X-Cache', 'HIT-CACHE');
    return res.json(cached);
  }

  // 3. Uniquement en dernier recours, requêter Firestore
  if (db && !isFirestoreQuotaExceeded()) {
    try {
      const snap = await getDoc(doc(db, 'campaigns', id));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as PricingCampaign;
        // Mettre en cache
        memoryCampaigns.push(data);
        saveLocalCampaignsDiskBackup();
        res.setHeader('X-Cache', 'HIT-FIRESTORE');
        return res.json(data);
      }
    } catch (e: any) {
      if (isQuotaExceededError(e)) {
        flagFirestoreQuotaExceeded(e);
      } else {
        console.warn('[Firestore] get campaign error:', e.message);
      }
    }
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
    comment
  } = req.body;
  if (!cityId) {
    return res.status(400).json({ error: 'cityId est obligatoire.' });
  }

  const city = cities.find(c => c.id === cityId);
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }
  if (!city.active) {
    return res.status(400).json({ error: 'Impossible de lancer un pricing sur une ville inactive. Activez la ville d’abord.' });
  }

  const activeNbs = neighborhoods.filter(n => n.cityId === cityId && n.active);
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

  const campaignId = randomUUID();
  const campaign: PricingCampaign = {
    id: campaignId,
    cityId: city.id,
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

  try {
    const result = await processCampaignChunk(id, chunkIndex);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erreur lors du traitement du lot.' });
  }
});

// Finalisation de la campagne
router.post('/api/campaigns/:id/finalize', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const campaign = await finalizeCampaignExecution(id);
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
  if (!campaign && db) {
    try {
      const snap = await getDoc(doc(db, 'campaigns', id));
      if (snap.exists()) campaign = { id: snap.id, ...snap.data() } as PricingCampaign;
    } catch {}
  }

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

// 4b. Mise à jour du commentaire d'une campagne
router.patch('/api/campaigns/:id/comment', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { comment } = req.body;
  const trimmedComment = typeof comment === 'string' ? comment.trim() : '';

  // 1. Mettre à jour en mémoire
  const memCamp = memoryCampaigns.find(c => c.id === id);
  if (memCamp) {
    memCamp.comment = trimmedComment;
    memCamp.comments = trimmedComment;
  }

  // 2. Mettre à jour dans le cache Firestore
  const cached = cachedFirestoreCampaigns.find(c => c.id === id);
  if (cached) {
    cached.comment = trimmedComment;
    cached.comments = trimmedComment;
  }

  // 3. Sauvegarde disque local
  saveLocalCampaignsDiskBackup();

  // 4. Sauvegarde Firestore
  if (db && !isFirestoreQuotaExceeded()) {
    try {
      await safeFirestoreWrite('updateCampaignComment', () =>
        setDoc(doc(db!, 'campaigns', id), cleanFirestoreDoc({ comment: trimmedComment, comments: trimmedComment }), { merge: true })
      );
    } catch (e: any) {
      console.warn('[Firestore] Warning saving campaign comment:', e.message);
    }
  }

  await recordHistory({
    action: 'update_campaign_comment',
    eventType: 'campaign',
    title: `Commentaire campagne mis à jour`,
    description: trimmedComment ? `Note: "${trimmedComment.slice(0, 80)}..."` : 'Commentaire supprimé',
    performedByName: 'Admin',
    metadata: { campaignId: id }
  }).catch(() => {});

  return res.json({ success: true, id, comment: trimmedComment, campaign: memCamp || cached });
});

// 5. Suppression globale
router.delete('/api/campaigns', async (_req: Request, res: Response) => {
  cachedFirestoreCampaigns = [];
  memoryCampaigns.length = 0;
  for (const id of Object.keys(memoryCampaignTrips)) {
    delete memoryCampaignTrips[id];
  }
  for (const id of Object.keys(memoryCampaignCanonicalTrips)) {
    delete memoryCampaignCanonicalTrips[id];
  }
  campaignSessions.clear();
  activePricingSessions.clear();
  saveLocalCampaignsDiskBackup();

  if (db) {
    try {
      const snap = await getDocs(collection(db, 'campaigns'));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      const resSnap = await getDocs(collection(db, 'campaign_results'));
      if (!resSnap.empty) {
        const batch = writeBatch(db);
        resSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e: any) {
      console.warn('[Firestore] Delete all campaigns error:', e.message);
    }
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
  cachedFirestoreCampaigns = cachedFirestoreCampaigns.filter(c => c.id !== id);
  const idx = memoryCampaigns.findIndex(c => c.id === id);
  if (idx >= 0) memoryCampaigns.splice(idx, 1);
  delete memoryCampaignTrips[id];
  delete memoryCampaignCanonicalTrips[id];
  campaignSessions.delete(id);
  saveLocalCampaignsDiskBackup();

  // Nettoyage Firestore asynchrone non-bloquant
  if (db) {
    Promise.allSettled([
      deleteCanonicalCampaign(id),
      deleteHistoryForCampaign(id)
    ]).catch(e => console.warn('[Firestore] Background delete error:', e));
  } else {
    deleteHistoryForCampaign(id).catch(() => {});
  }

  return res.json({ success: true, message: 'Campagne, résultats et historiques associés supprimés avec succès.' });
});

// 7. Résultats des trajets (Exploite notre cache RAM, disque local et JSON canonique pour garantir 0 lecture Firestore)
router.get('/api/campaigns/:id/results', async (req: Request, res: Response) => {
  const { id } = req.params;

  // 1. Session active en cours
  const session = activePricingSessions.get(id);
  if (session && session.trips.length > 0) {
    res.setHeader('X-Cache', 'HIT-SESSION');
    return res.json(session.trips);
  }

  // 2. Cache mémoire RAM serveur instantané (2ms, 0 lecture Firestore)
  if (memoryCampaignTrips[id] && memoryCampaignTrips[id].length > 0) {
    res.setHeader('X-Cache', 'HIT-RAM');
    return res.json(memoryCampaignTrips[id]);
  }

  // 3. Cache disque local serveur persistant (survit aux redémarrages et quotas)
  const diskTrips = loadCampaignTripsDiskBackup(id);
  if (diskTrips && diskTrips.length > 0) {
    res.setHeader('X-Cache', 'HIT-DISK');
    return res.json(diskTrips);
  }

  // 4. Lecture du JSON canonique en base de données Firestore (si quota disponible)
  if (!isFirestoreQuotaExceeded()) {
    const canonicalTrips = await loadCanonicalCampaignResults(id);
    if (canonicalTrips.length > 0) {
      const cleanTrips = canonicalTrips.map(t => {
        const pYango = t.prices?.yango || { eco: null, confort: null, confortPlus: null, moto: null };
        return {
          id: t.id,
          campaignId: id,
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

      memoryCampaignTrips[id] = cleanTrips;
      // Sauvegarder immédiatement sur disque local pour les prochains redémarrages
      saveCampaignTripsDiskBackup(id, cleanTrips, canonicalTrips);
      res.setHeader('X-Cache', 'HIT-FIRESTORE');
      return res.json(cleanTrips);
    }
  }

  // Si aucun trajet n'est encore enregistré ou si la campagne débute, renvoyer un tableau vide [] avec statut 200 (pas d'erreur 404)
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

  const session = activePricingSessions.get(id);
  if (session) {
    canonicalTrips = session.canonicalTrips;
  } else if (memoryCampaignCanonicalTrips[id]) {
    canonicalTrips = memoryCampaignCanonicalTrips[id];
  } else {
    canonicalTrips = await loadCanonicalCampaignResults(id);
  }

  let campaign = memoryCampaigns.find(c => c.id === id);
  if (!campaign && db) {
    try {
      const snap = await getDoc(doc(db, 'campaigns', id));
      if (snap.exists()) {
        campaign = { id: snap.id, ...snap.data() } as PricingCampaign;
      }
    } catch {}
  }

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
  const canonicalTrips = await loadCanonicalCampaignResults(id);

  let campaign = memoryCampaigns.find(c => c.id === id);
  if (!campaign && db) {
    try {
      const snap = await getDoc(doc(db, 'campaigns', id));
      if (snap.exists()) {
        campaign = { id: snap.id, ...snap.data() } as PricingCampaign;
      }
    } catch {}
  }

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

export default router;
