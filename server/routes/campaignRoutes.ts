import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, cleanFirestoreDoc, safeFirestoreWrite, loadCanonicalCampaignResults, initCanonicalCampaignResults } from '../db/firestore.js';
import {
  cities,
  neighborhoods,
  memoryCampaigns,
  memoryCampaignTrips,
  memoryCampaignCanonicalTrips,
  activePricingSessions,
  recordHistory
} from '../db/memoryStore.js';
import { PricingCampaign, CanonicalTrip } from '../types.js';
import {
  initializeCampaignSession,
  processCampaignChunk,
  finalizeCampaignExecution,
  cleanNeighborhoodName
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

  if (list.length === 0) {
    list = [...memoryCampaigns];
  }

  // Fusion avec les campagnes actives en mémoire
  for (const [id, session] of activePricingSessions.entries()) {
    const idx = list.findIndex(c => c.id === id);
    if (idx >= 0) {
      list[idx] = { ...session.campaign };
    } else {
      list.unshift({ ...session.campaign });
    }
  }

  list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return res.json(list);
});

// 2. Détail d'une campagne
router.get('/api/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
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

  const limit = sampleLimit ? parseInt(String(sampleLimit), 10) : (isTestSample ? 25 : undefined);
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

// 4. Interruption manuelle
router.post('/api/campaigns/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = activePricingSessions.get(id);
  if (!session) {
    return res.status(404).json({ error: 'Session de tarification active introuvable pour cette campagne.' });
  }

  session.cancelled = true;
  session.abortController.abort();
  session.campaign.status = 'cancelled';

  return res.json({ success: true, message: 'Arrêt de la campagne demandé.' });
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
      for (const d of snap.docs) {
        await safeFirestoreWrite('deleteCamp', () => deleteDoc(d.ref));
      }
      const resSnap = await getDocs(collection(db, 'campaign_results'));
      for (const d of resSnap.docs) {
        await safeFirestoreWrite('deleteRes', () => deleteDoc(d.ref));
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
  const deletedCamp = idx >= 0 ? memoryCampaigns.splice(idx, 1)[0] : null;
  delete memoryCampaignTrips[id];
  delete memoryCampaignCanonicalTrips[id];

  if (db) {
    await safeFirestoreWrite('deleteCamp', () => deleteDoc(doc(db!, 'campaigns', id)));
    await safeFirestoreWrite('deleteRes', () => deleteDoc(doc(db!, 'campaign_results', id)));
    // Supprimer également les éventuelles partitions additionnelles
    for (let p = 2; p <= 10; p++) {
      await safeFirestoreWrite(`deleteResPart${p}`, () => deleteDoc(doc(db!, 'campaign_results', `${id}_part${p}`)));
    }
  }

  await recordHistory({
    action: 'delete_campaign',
    eventType: 'campaign',
    title: `Campagne supprimée : ${deletedCamp?.cityName || id}`,
    description: `Suppression définitive de la campagne ${id} et de ses données associées.`
  });

  return res.json({ success: true, message: 'Campagne supprimée avec succès.' });
});

// 7. Résultats des trajets (Exploite notre JSON canonique pour garantir < 1 Mo)
router.get('/api/campaigns/:id/results', async (req: Request, res: Response) => {
  const { id } = req.params;

  // 1. Session active en cours
  const session = activePricingSessions.get(id);
  if (session) {
    return res.json(session.trips);
  }

  // 2. Cache mémoire rapide
  if (memoryCampaignTrips[id] && memoryCampaignTrips[id].length > 0) {
    return res.json(memoryCampaignTrips[id]);
  }

  // 3. Lecture du JSON canonique en base de données Firestore
  const canonicalTrips = await loadCanonicalCampaignResults(id);
  if (canonicalTrips.length > 0) {
    // Conversion fluide vers les colonnes attendues par le tableau
    const normalizedRows = canonicalTrips.map(t => {
      const yEco = t.prices.yango?.eco || null;
      const yConf = t.prices.yango?.confort || null;
      const yConfPlus = t.prices.yango?.confortPlus || null;
      const yMoto = t.prices.yango?.moto || null;

      const hEco = t.prices.heroCab?.eco || null;
      const hConf = t.prices.heroCab?.confort || null;
      const hSuv = t.prices.heroCab?.suv || null;
      const hPerKm = t.prices.heroCab?.perKm || null;

      const tmEco = t.prices.tripMaster?.eco || null;
      const tmConf = t.prices.tripMaster?.confort || null;
      const tmMoto = t.prices.tripMaster?.moto || null;

      const pMain = yEco || hEco || tmEco || 0;

      return {
        id: t.id,
        campaignId: id,
        origin: t.origin,
        destination: t.destination,
        startNeighborhoodName: t.origin,
        endNeighborhoodName: t.destination,
        distanceKm: t.distanceKm,
        durationMinutes: t.durationMin,
        price: pMain,
        priceFormatted: `${pMain.toLocaleString('fr-FR')} FCFA`,
        tariffClass: 'econom',
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
        cheaperProvider: t.cheapest?.eco || 'yango',
        deltaPriceYangoVsHero: (yEco && hEco) ? yEco - hEco : 0,
        prices: t.prices,
        createdAt: t.createdAt
      };
    });

    memoryCampaignTrips[id] = normalizedRows as any;
    return res.json(normalizedRows);
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
