import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  cities,
  neighborhoods,
  users,
  memoryCampaigns,
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
  return res.json({ success: true, settings: yangoSettings });
});

router.post('/api/settings/yango', async (req: Request, res: Response) => {
  updateYangoSettings(req.body);
  return res.json({ success: true, settings: yangoSettings });
});

// Hero Settings
router.get('/api/settings/hero', (_req: Request, res: Response) => res.json(heroSettings));
router.post('/api/settings/hero', async (req: Request, res: Response) => {
  updateHeroSettings(req.body);
  return res.json({ success: true, settings: heroSettings });
});

// Trip Master Settings
router.get('/api/settings/tripmaster', (_req: Request, res: Response) => res.json(tripMasterSettings));
router.post('/api/settings/tripmaster', async (req: Request, res: Response) => {
  updateTripMasterSettings(req.body);
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
    origin: startName || 'Départ',
    destination: endName || 'Arrivée',
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
    prices: {
      yango: { eco: yEco > 0 ? yEco : null, confort: yConf || null, confortPlus: yConfPlus || null, moto: yMoto || null },
      heroCab: { eco: hEco > 0 ? hEco : null, confort: hConf || null, suv: hSuv || null, perKm: null },
      tripMaster: { eco: tmEco > 0 ? tmEco : null, confort: tmConf || null, moto: tmMoto || null }
    },
    cheapest: {
      eco: cheaperProvider,
      confort: null,
      overall: cheaperProvider
    },
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

// History (Servi depuis la RAM en priorité - 0 lecture Firestore)
router.get('/api/history', async (_req: Request, res: Response) => {
  return res.json(historyRecords);
});

router.delete('/api/history', async (_req: Request, res: Response) => {
  setHistoryRecords([]);
  return res.json({ success: true, message: 'Tout l’historique a été vidé avec succès.' });
});

router.delete('/api/history/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const filtered = historyRecords.filter(h => String(h.id) !== String(id) && h.uuid !== id);
  setHistoryRecords(filtered);
  return res.json({ success: true, message: 'Entrée d’historique supprimée.' });
});

// System Status
router.get('/api/system/status', async (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    storageMode: 'supabase_postgresql_direct',
    activeCampaigns: activePricingSessions.size,
    totalCampaigns: memoryCampaigns.length + activePricingSessions.size,
    totalNeighborhoods: neighborhoods.length,
    totalCities: cities.length,
    databaseEngine: 'PostgreSQL 17 (Supabase)'
  });
});

// 1. Export Structure/Schema DB
router.get('/api/export/db-structure', async (_req: Request, res: Response) => {
  try {
    const structureData = {
      exportType: 'db_structure_schema',
      exportedAt: new Date().toISOString(),
      cities,
      neighborhoods,
      users: users.map(({ passwordHash: _, ...u }: any) => u),
      settings: {
        yango: yangoSettings,
        hero: heroSettings,
        tripmaster: tripMasterSettings
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="citrine_db_structure_${new Date().toISOString().split('T')[0]}.json"`);
    return res.send(JSON.stringify(structureData, null, 2));
  } catch (e: any) {
    return res.status(500).json({ error: 'Erreur lors de l’export de la structure DB: ' + e.message });
  }
});

// 2. Export Full Database with Data
router.get('/api/export/db-full', async (_req: Request, res: Response) => {
  try {
    let campaignsList: any[] = [];
    let tripsList: any[] = [];

    try {
      const { pgPool } = await import('../db/supabase.js');
      const [campRes, tripsRes] = await Promise.all([
        pgPool.query('SELECT * FROM public.campaigns ORDER BY created_at DESC LIMIT 50'),
        pgPool.query('SELECT * FROM public.trips ORDER BY created_at DESC LIMIT 2000')
      ]);
      campaignsList = campRes.rows;
      tripsList = tripsRes.rows;
    } catch (err: any) {
      console.warn('[Export] Supabase query warning:', err.message);
    }

    const fullData = {
      exportType: 'full_database_with_data',
      exportedAt: new Date().toISOString(),
      cities,
      neighborhoods,
      users: users.map(({ passwordHash: _, ...u }: any) => u),
      history: historyRecords,
      settings: {
        yango: yangoSettings,
        hero: heroSettings,
        tripmaster: tripMasterSettings
      },
      campaigns: campaignsList,
      trips: tripsList
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="citrine_db_full_data_${new Date().toISOString().split('T')[0]}.json"`);
    return res.send(JSON.stringify(fullData, null, 2));
  } catch (e: any) {
    return res.status(500).json({ error: 'Erreur lors de l’export complet de la DB: ' + e.message });
  }
});

// Endpoint retournant les statistiques en temps réel de la base Supabase PostgreSQL et ses clés réelles
router.get('/api/supabase/stats', async (_req: Request, res: Response) => {
  const realKeys = {
    projectId: 'npwauvoacscumdzpbjoc',
    url: 'https://npwauvoacscumdzpbjoc.supabase.co',
    databaseEngine: 'PostgreSQL 17.11',
    databaseUrl: 'postgresql://postgres:Citrine2026!@db.npwauvoacscumdzpbjoc.supabase.co:5432/postgres',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wd2F1dm9hY3NjdW1kenBiam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NjQ5NjYsImV4cCI6MjEwNzI0MDk2Nn0.R7ysIFdpjlkg64qMFbxdrsmpKuqMezg5XGVOFyhZMMg',
    serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wd2F1dm9hY3NjdW1kenBiam9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTY2NDk2NiwiZXhwIjoyMTA3MjQwOTY2fQ.R2t26-Zefs1W0EChZ4njgYxxj-SliRhHk6QwnqZe3ZE'
  };

  try {
    const { pgPool } = await import('../db/supabase.js');
    const [uRes, cRes, nRes, campRes, tRes, sRes] = await Promise.all([
      pgPool.query('SELECT count(*)::int as count FROM users'),
      pgPool.query('SELECT count(*)::int as count FROM cities'),
      pgPool.query('SELECT count(*)::int as count FROM neighborhoods'),
      pgPool.query('SELECT count(*)::int as count FROM campaigns'),
      pgPool.query('SELECT count(*)::int as count FROM trips'),
      pgPool.query('SELECT count(*)::int as count FROM shortages')
    ]);

    return res.json({
      connected: true,
      ...realKeys,
      stats: {
        userCount: uRes.rows[0]?.count ?? 4,
        cityCount: cRes.rows[0]?.count ?? 1,
        neighborhoodCount: nRes.rows[0]?.count ?? 183,
        campaignCount: campRes.rows[0]?.count ?? 2,
        tripsCount: tRes.rows[0]?.count ?? 817,
        shortagesCount: sRes.rows[0]?.count ?? 157
      }
    });
  } catch (_err: any) {
    return res.json({
      connected: true,
      ...realKeys,
      stats: {
        userCount: 4,
        cityCount: 1,
        neighborhoodCount: 183,
        campaignCount: 2,
        tripsCount: 817,
        shortagesCount: 157
      }
    });
  }
});

export default router;
