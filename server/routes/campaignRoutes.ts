import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, cleanFirestoreDoc, safeFirestoreWrite, loadCanonicalCampaignResults, initCanonicalCampaignResults, deleteCanonicalCampaign } from '../db/firestore.js';
import {
  cities,
  neighborhoods,
  memoryCampaigns,
  memoryCampaignTrips,
  memoryCampaignCanonicalTrips,
  activePricingSessions,
  recordHistory,
  deleteHistoryForCampaign
} from '../db/memoryStore.js';
import { PricingCampaign, CanonicalTrip } from '../types.js';
import {
  initializeCampaignSession,
  processCampaignChunk,
  finalizeCampaignExecution,
  cancelChunkCampaignSession,
  cleanNeighborhoodName,
  campaignSessions
} from '../services/campaignEngine.js';
import { generateBenchmarkPairs, calculatePossibleBenchmarkPairsCount } from '../../src/utils/routeMatrix.js';

const router = Router();

// 1. Liste des campagnes
router.get('/api/campaigns', async (_req: Request, res: Response) => {
  let list: PricingCampaign[] = [];

  if (db) {
    try {
      const snap = await getDocs(collection(db, 'campaigns'));
      if (!snap.empty) {
        list = snap.docs.map(d => ({ id: d.id, ...d.data() } as PricingCampaign));
      }
    } catch (e: any) {
      console.warn('[Firestore] get campaigns error:', e.message);
    }
  }

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

  // Nettoyage des anciennes campagnes orphelines (évite l'apparition de campagnes fantômes "en cours")
  list = list.map(c => {
    const isActiveInRam = campaignSessions.has(c.id) || activePricingSessions.has(c.id);
    if (c.status === 'in_progress' && !isActiveInRam) {
      const isActuallyFinished = c.completedPairs && c.totalPairs && c.completedPairs >= c.totalPairs;
      if (isActuallyFinished) {
        return { ...c, status: 'completed' };
      }
      const ageMs = Date.now() - new Date(c.startedAt || 0).getTime();
      // Si la campagne date de plus de 10 minutes et n'est plus en RAM, elle a été terminée ou interrompue
      if (ageMs > 10 * 60 * 1000) {
        return { ...c, status: 'cancelled' };
      }
    }
    return c;
  });

  return res.json(list);
});

// 2. Détail d'une campagne
router.get('/api/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const chunkSession = campaignSessions.get(id);
  if (chunkSession) {
    return res.json(chunkSession.campaign);
  }
  const session = activePricingSessions.get(id);
  if (session) {
    return res.json(session.campaign);
  }

  if (db) {
    try {
      const snap = await getDoc(doc(db, 'campaigns', id));
      if (snap.exists()) {
        return res.json({ id: snap.id, ...snap.data() });
      }
    } catch (e: any) {
      console.warn('[Firestore] get campaign error:', e.message);
    }
  }

  const mem = memoryCampaigns.find(c => c.id === id);
  if (mem) return res.json(mem);

  return res.status(404).json({ error: 'Campagne introuvable.' });
});

// 3. Lancement d'une campagne (Test rapide ou complète)
router.post('/api/campaigns/start', async (req: Request, res: Response) => {
  const { cityId, sampleLimit, triggerType, isTestSample, triggeredByUserId, triggeredByUserName } = req.body;
  if (!cityId) {
    return res.status(400).json({ error: 'cityId est obligatoire.' });
  }

  const city = cities.find(c => c.id === cityId);
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  const activeNbs = neighborhoods.filter(n => n.cityId === cityId && n.active);
  if (activeNbs.length < 2) {
    return res.status(400).json({ error: 'Au moins 2 quartiers actifs sont requis pour calculer des trajets.' });
  }

  let pairs = generateBenchmarkPairs(activeNbs);
  const totalPossible = calculatePossibleBenchmarkPairsCount(activeNbs);

  const limit = (sampleLimit && sampleLimit !== 'all') ? parseInt(String(sampleLimit), 10) : (isTestSample ? 25 : undefined);
  if (limit && limit > 0 && limit < pairs.length) {
    pairs = pairs.slice(0, limit);
  }

  const cleanTriggeredByName = (triggeredByUserName && !String(triggeredByUserName).toLowerCase().includes('landry'))
    ? String(triggeredByUserName)
    : 'Admin Citrine';

  const campaignId = randomUUID();
  const campaign: PricingCampaign = {
    id: campaignId,
    cityId: city.id,
    cityName: city.name,
    currency: city.currency,
    triggerType: triggerType || 'manual',
    triggeredByUserId: triggeredByUserId || 'admin_user',
    triggeredByUserName: cleanTriggeredByName,
    status: 'in_progress',
    totalPairs: pairs.length,
    completedPairs: 0,
    failedPairs: 0,
    startedAt: new Date().toISOString(),
    isTestSample: Boolean(isTestSample || (limit && limit <= 50)),
    sampleLimit: limit,
    totalPossiblePairs: totalPossible,
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Démarrage de la campagne ${isTestSample ? 'Test ' : ''}(${pairs.length} trajets) pour ${city.name}.`
      }
    ]
  };

  // Initialisation de la session de campagne
  const { totalChunks, totalPairs } = await initializeCampaignSession(campaign, city, pairs);

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

  // Réponse immédiate en 0ms au client sans attendre Firestore !
  return res.json({ success: true, message: 'Arrêt immédiat de la campagne effectué en mémoire.' });
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
  const idx = memoryCampaigns.findIndex(c => c.id === id);
  if (idx >= 0) memoryCampaigns.splice(idx, 1);
  delete memoryCampaignTrips[id];
  delete memoryCampaignCanonicalTrips[id];

  if (db) {
    await deleteCanonicalCampaign(id);
  }

  // Supprimer tous les historiques liés à cette campagne
  await deleteHistoryForCampaign(id);

  return res.json({ success: true, message: 'Campagne, résultats et historiques associés supprimés avec succès.' });
});

// 7. Résultats des trajets (Exploite notre cache RAM et JSON canonique pour garantir 0 lecture Firestore)
router.get('/api/campaigns/:id/results', async (req: Request, res: Response) => {
  const { id } = req.params;

  // 1. Session active en cours
  const session = activePricingSessions.get(id);
  if (session) {
    res.setHeader('X-Cache', 'HIT-SESSION');
    return res.json(session.trips);
  }

  // 2. Cache mémoire RAM serveur instantané (2ms, 0 lecture Firestore)
  if (memoryCampaignTrips[id] && memoryCampaignTrips[id].length > 0) {
    res.setHeader('X-Cache', 'HIT-RAM');
    return res.json(memoryCampaignTrips[id]);
  }

  // 3. Lecture du JSON canonique en base de données Firestore
  const canonicalTrips = await loadCanonicalCampaignResults(id);
  if (canonicalTrips.length > 0) {
    const cleanTrips = canonicalTrips.map(t => ({
      id: t.id,
      campaignId: id,
      origin: t.origin,
      destination: t.destination,
      distanceKm: t.distanceKm,
      durationMinutes: t.durationMin,
      prices: t.prices,
      cheapest: t.cheapest,
      status: t.status,
      createdAt: t.createdAt
    }));

    memoryCampaignTrips[id] = cleanTrips as any;
    return res.json(cleanTrips);
  }

  // Si aucun trajet n'est encore enregistré ou si la campagne débute, renvoyer un tableau vide [] avec statut 200 (pas d'erreur 404)
  return res.json([]);
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
