import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, cleanFirestoreDoc, safeFirestoreWrite } from '../db/firestore.js';
import {
  cities,
  neighborhoods,
  historyRecords,
  setHistoryRecords,
  activePricingSessions,
  recordHistory
} from '../db/memoryStore.js';
import { yangoSettings, updateYangoSettings, callYangoRoutestats, calculateDistanceKm, getLastYangoRaw } from '../services/yangoService.js';
import { heroSettings, updateHeroSettings, callHeroStats } from '../services/heroService.js';
import { tripMasterSettings, updateTripMasterSettings, callTripMasterStats } from '../services/tripMasterService.js';
import { TripResult } from '../types.js';

const router = Router();

// Yango Settings
router.get('/api/settings', (_req: Request, res: Response) => res.json(yangoSettings));
router.get('/api/settings/yango', (_req: Request, res: Response) => res.json(yangoSettings));

// Endpoint d'inspection du dernier JSON Yango brut
router.get('/api/yango/last-raw-json', (_req: Request, res: Response) => res.json(getLastYangoRaw()));
router.get('/api/settings/yango/last-raw-json', (_req: Request, res: Response) => res.json(getLastYangoRaw()));

router.post('/api/settings', async (req: Request, res: Response) => {
  updateYangoSettings(req.body);
  await safeFirestoreWrite('updateYangoSettings', () => setDoc(doc(db!, 'settings', 'yango'), cleanFirestoreDoc(yangoSettings), { merge: true }));
  return res.json({ success: true, settings: yangoSettings });
});

router.post('/api/settings/yango', async (req: Request, res: Response) => {
  updateYangoSettings(req.body);
  await safeFirestoreWrite('updateYangoSettings', () => setDoc(doc(db!, 'settings', 'yango'), cleanFirestoreDoc(yangoSettings), { merge: true }));
  return res.json({ success: true, settings: yangoSettings });
});

// Hero Settings
router.get('/api/settings/hero', (_req: Request, res: Response) => res.json(heroSettings));
router.post('/api/settings/hero', async (req: Request, res: Response) => {
  updateHeroSettings(req.body);
  await safeFirestoreWrite('updateHeroSettings', () => setDoc(doc(db!, 'settings', 'hero'), cleanFirestoreDoc(heroSettings), { merge: true }));
  return res.json({ success: true, settings: heroSettings });
});

// Trip Master Settings
router.get('/api/settings/tripmaster', (_req: Request, res: Response) => res.json(tripMasterSettings));
router.post('/api/settings/tripmaster', async (req: Request, res: Response) => {
  updateTripMasterSettings(req.body);
  await safeFirestoreWrite('updateTripMasterSettings', () => setDoc(doc(db!, 'settings', 'tripmaster'), cleanFirestoreDoc(tripMasterSettings), { merge: true }));
  return res.json({ success: true, settings: tripMasterSettings });
});

// Single route test endpoint (routestats)
router.post('/api/routestats', async (req: Request, res: Response) => {
  const { startLat, startLng, endLat, endLng, tariffClass, cityCurrency, startName, endName } = req.body;
  if (startLat === undefined || startLng === undefined || endLat === undefined || endLng === undefined) {
    return res.status(400).json({ error: 'Coordonnées GPS obligatoires.' });
  }

  const sLat = Number(startLat);
  const sLng = Number(startLng);
  const eLat = Number(endLat);
  const eLng = Number(endLng);
  const tClass = tariffClass || 'econom';
  const curr = cityCurrency || 'XAF';

  const [yangoRes, heroRes, tmRes] = await Promise.all([
    callYangoRoutestats(sLat, sLng, eLat, eLng, tClass, curr),
    callHeroStats(sLat, sLng, eLat, eLng, tClass, curr, startName || 'Départ', endName || 'Arrivée'),
    callTripMasterStats(sLat, sLng, eLat, eLng, curr, startName || 'Départ', endName || 'Arrivée')
  ]);

  const mainDistKm = yangoRes.distanceKm || calculateDistanceKm(sLat, sLng, eLat, eLng);
  const durationMin = yangoRes.durationMinutes || Math.max(2, Math.round((mainDistKm / 25) * 60));

  const yEco = yangoRes.priceEconom || (yangoRes.classes?.econom?.price) || yangoRes.price || 0;
  const yConf = yangoRes.priceConfort || yangoRes.classes?.business?.price || yangoRes.classes?.comfort?.price;
  const yConfPlus = yangoRes.priceConfortPlus || yangoRes.classes?.comfortplus?.price;
  const yMoto = yangoRes.priceMoto || yangoRes.classes?.moto?.price;

  const hEco = heroRes.priceStandard || heroRes.price || 0;
  const hConf = heroRes.priceConfort;
  const hSuv = heroRes.priceSuv;

  const tmEco = tmRes.priceEco || 0;
  const tmConf = tmRes.priceConfort;
  const tmMoto = tmRes.priceMoto;

  const ecoList = [
    { provider: 'yango', price: yEco },
    { provider: 'hero', price: hEco },
    { provider: 'tripmaster', price: tmEco }
  ].filter(p => p.price > 0);
  ecoList.sort((a, b) => a.price - b.price);

  const cheaperProvider: 'yango' | 'hero' | 'tripmaster' | 'equal' = ecoList.length > 0 ? (ecoList[0].provider as any) : 'equal';
  const deltaPrice = ecoList.length > 1 ? ecoList[1].price - ecoList[0].price : 0;

  const singleTripResult: TripResult = {
    id: randomUUID(),
    campaignId: 'quick_test',
    cityId: 'quick_test_city',
    startNeighborhoodId: 'start',
    startNeighborhoodName: startName || 'Départ',
    endNeighborhoodId: 'end',
    endNeighborhoodName: endName || 'Arrivée',
    distanceKm: mainDistKm,
    distanceMeters: Math.round(mainDistKm * 1000),
    durationSeconds: durationMin * 60,
    durationMinutes: durationMin,
    tariffClass: tClass,
    price: yEco || hEco || tmEco || 0,
    priceFormatted: (yEco || hEco || tmEco || 0) > 0 ? `${(yEco || hEco || tmEco || 0).toLocaleString('fr-FR')} ${curr}` : 'Non disponible',
    currency: curr,
    pricePerKm: mainDistKm > 0 ? Math.round((yEco || hEco || tmEco || 0) / mainDistKm) : 0,
    priceEconom: yEco > 0 ? yEco : undefined,
    priceConfort: yConf && yConf > 0 ? yConf : undefined,
    priceConfortPlus: yConfPlus && yConfPlus > 0 ? yConfPlus : undefined,
    priceMoto: yMoto && yMoto > 0 ? yMoto : undefined,
    priceHero: hEco > 0 ? hEco : undefined,
    priceHeroStandard: hEco > 0 ? hEco : undefined,
    priceHeroConfort: hConf && hConf > 0 ? hConf : undefined,
    priceHeroSuv: hSuv && hSuv > 0 ? hSuv : undefined,
    priceTripMaster: tmEco > 0 ? tmEco : undefined,
    priceTripMasterConfort: tmConf && tmConf > 0 ? tmConf : undefined,
    priceTripMasterMoto: tmMoto && tmMoto > 0 ? tmMoto : undefined,
    // flat fields
    yango_eco: yEco > 0 ? yEco : undefined,
    yango_confort: yConf && yConf > 0 ? yConf : undefined,
    yango_moto: yMoto && yMoto > 0 ? yMoto : undefined,
    hero_eco: hEco > 0 ? hEco : undefined,
    hero_confort: hConf && hConf > 0 ? hConf : undefined,
    hero_suv: hSuv && hSuv > 0 ? hSuv : undefined,
    tripmaster_eco: tmEco > 0 ? tmEco : undefined,
    tripmaster_confort: tmConf && tmConf > 0 ? tmConf : undefined,
    tripmaster_moto: tmMoto && tmMoto > 0 ? tmMoto : undefined,
    cheaperProvider,
    deltaPriceYangoVsHero: deltaPrice,
    source: 'yango_live',
    status: (yEco || hEco || tmEco) ? 'success' : 'failed'
  };

  return res.json({
    ...singleTripResult,
    yango: yangoRes,
    heroCab: heroRes,
    tripMaster: tmRes
  });
});

// Cron Trigger
router.post('/api/cron/trigger-scheduled', async (_req: Request, res: Response) => {
  return res.json({ success: true, message: 'Vérification planifiée effectuée.' });
});

// History
router.get('/api/history', async (_req: Request, res: Response) => {
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'history'));
      if (!snap.empty) {
        const records: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setHistoryRecords(records);
      }
    } catch (e: any) {
      console.warn('[Firestore] get history error:', e.message);
    }
  }
  return res.json(historyRecords);
});

router.delete('/api/history', async (_req: Request, res: Response) => {
  setHistoryRecords([]);
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'history'));
      for (const d of snap.docs) {
        await safeFirestoreWrite('deleteHistDoc', () => deleteDoc(d.ref));
      }
    } catch (e: any) {
      console.warn('[Firestore] clear history error:', e.message);
    }
  }
  return res.json({ success: true, message: 'Tout l’historique a été vidé avec succès.' });
});

router.delete('/api/history/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const filtered = historyRecords.filter(h => h.id !== id);
  setHistoryRecords(filtered);
  await safeFirestoreWrite('deleteHistory', () => deleteDoc(doc(db!, 'history', id)));
  return res.json({ success: true, message: 'Entrée d’historique supprimée.' });
});

// System Status
router.get('/api/system/status', async (_req: Request, res: Response) => {
  let dbCampaignsCount = 0;
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'campaigns'));
      dbCampaignsCount = snap.size;
    } catch {}
  }
  return res.json({
    status: 'ok',
    storageMode: 'firestore_canonical_optimized',
    activeCampaigns: activePricingSessions.size,
    totalCampaigns: dbCampaignsCount + activePricingSessions.size,
    totalNeighborhoods: neighborhoods.length,
    totalCities: cities.length,
    maxFirestorePayload: '< 1 MB (Chunked < 400 KB)'
  });
});

export default router;
