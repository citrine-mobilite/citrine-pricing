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
import { getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection, syncAllDataWithSupabase, getSupabaseSqlSchema } from '../db/supabase.js';
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

// Supabase Settings & Connection
router.get('/api/settings/supabase', (_req: Request, res: Response) => {
  const config = getSupabaseConfig();
  return res.json({
    url: config.url,
    anonKey: config.anonKey ? `${config.anonKey.slice(0, 8)}...${config.anonKey.slice(-6)}` : '',
    hasConfig: Boolean(config.url && config.anonKey)
  });
});

router.post('/api/settings/supabase', async (req: Request, res: Response) => {
  const { url, anonKey } = req.body;
  if (!url || !anonKey) {
    return res.status(400).json({ error: 'URL et Clé API Supabase requises.' });
  }

  const updated = saveSupabaseConfig({
    url: String(url).trim(),
    anonKey: String(anonKey).trim()
  });

  return res.json({
    success: true,
    message: 'Configuration Supabase enregistrée.',
    hasConfig: Boolean(updated.url && updated.anonKey)
  });
});

router.post('/api/settings/supabase/test', async (_req: Request, res: Response) => {
  const result = await testSupabaseConnection();
  return res.json(result);
});

router.post('/api/settings/supabase/sync', async (req: Request, res: Response) => {
  const direction = req.body?.direction === 'pull' ? 'pull' : 'push';
  const result = await syncAllDataWithSupabase(direction);
  return res.json(result);
});

router.get('/api/settings/supabase/schema', async (_req: Request, res: Response) => {
  return res.json({
    schema: getSupabaseSqlSchema()
  });
});

// Single route test endpoint (routestats)
router.post('/api/routestats', async (req: Request, res: Response) => {
  const { startLat, startLng, endLat, endLng, tariffClass, cityCurrency, startName, endName } = req.body;
  if (startLat === undefined || startLng === undefined || endLat === undefined || endLng === undefined) {
    return res.status(400).json({ error: 'Coordonnées de départ et d’arrivée requises.' });
  }

  const currency = cityCurrency || 'XAF';
  const distanceKm = calculateDistanceKm(startLat, startLng, endLat, endLng);

  // Appel simultané des 3 services avec leurs vrais paramètres
  const [yangoRes, heroRes, tripMasterRes] = await Promise.all([
    callYangoRoutestats(startLat, startLng, endLat, endLng, tariffClass || 'econom', currency).catch(e => {
      console.warn('[Single Route] Yango error:', e.message);
      return null;
    }),
    callHeroStats(startLat, startLng, endLat, endLng).catch(e => {
      console.warn('[Single Route] Hero error:', e.message);
      return null;
    }),
    callTripMasterStats(startLat, startLng, endLat, endLng, currency, startName || 'Départ', endName || 'Arrivée').catch(e => {
      console.warn('[Single Route] Trip Master error:', e.message);
      return null;
    })
  ]);

  const yangoPrice = yangoRes?.priceEconom || yangoRes?.price || yangoRes?.classes?.econom?.price || null;
  const yangoConfort = yangoRes?.priceConfort || yangoRes?.classes?.business?.price || yangoRes?.classes?.comfortplus?.price || null;
  const yangoMoto = yangoRes?.priceMoto || yangoRes?.classes?.moto?.price || null;

  const heroPrice = heroRes?.price || null;
  const heroConfort = heroRes?.priceConfort || null;
  const heroSuv = heroRes?.priceSuv || null;

  const tripMasterPrice = tripMasterRes?.priceEco || null;
  const tripMasterConfort = tripMasterRes?.priceConfort || null;
  const tripMasterMoto = tripMasterRes?.priceMoto || null;

  // Calcul du moins cher
  const validPrices: Array<{ name: string; price: number }> = [];
  if (yangoPrice) validPrices.push({ name: 'yango', price: yangoPrice });
  if (heroPrice) validPrices.push({ name: 'hero', price: heroPrice });
  if (tripMasterPrice) validPrices.push({ name: 'tripmaster', price: tripMasterPrice });

  let cheapest: 'yango' | 'hero' | 'tripmaster' | 'tie' | 'none' = 'none';
  let minPrice = Infinity;
  for (const p of validPrices) {
    if (p.price < minPrice) {
      minPrice = p.price;
      cheapest = p.name as any;
    } else if (p.price === minPrice) {
      cheapest = 'tie';
    }
  }

  const result = {
    id: `trip_test_${randomUUID().slice(0, 8)}`,
    origin: startName || `${startLat.toFixed(4)}, ${startLng.toFixed(4)}`,
    destination: endName || `${endLat.toFixed(4)}, ${endLng.toFixed(4)}`,
    distanceKm: yangoRes?.distanceKm || distanceKm,
    durationMinutes: yangoRes?.durationMinutes || Math.round(distanceKm * 2.5),
    jams: yangoRes?.jams || false,
    yangoUnavailable: yangoRes?.yangoUnavailable || false,
    yangoWaitingMinutes: yangoRes?.waitingTimeMinutes || yangoRes?.yangoWaitingMinutes,
    prices: {
      yango: {
        eco: yangoPrice,
        confort: yangoConfort,
        moto: yangoMoto
      },
      heroCab: {
        eco: heroPrice,
        confort: heroConfort,
        suv: heroSuv
      },
      tripMaster: {
        eco: tripMasterPrice,
        confort: tripMasterConfort,
        moto: tripMasterMoto
      }
    },
    cheapest: {
      eco: cheapest,
      confort: null,
      overall: cheapest
    },
    // Objets bruts pour affichage détaillé et inspection
    yango: yangoRes,
    hero: heroRes,
    heroCab: heroRes,
    tripMaster: tripMasterRes,
    // Propriétés plates pour affichage direct dans les composants
    price: yangoPrice || heroPrice || tripMasterPrice || 0,
    priceEconom: yangoPrice || undefined,
    priceConfort: yangoConfort || undefined,
    priceMoto: yangoMoto || undefined,
    priceHero: heroPrice || undefined,
    priceHeroStandard: heroPrice || undefined,
    priceHeroConfort: heroConfort || undefined,
    priceHeroSuv: heroSuv || undefined,
    priceHeroPerKm: heroRes?.pricePerKm || undefined,
    priceTripMaster: tripMasterPrice || undefined,
    priceTripMasterConfort: tripMasterConfort || undefined,
    priceTripMasterMoto: tripMasterMoto || undefined,
    yango_eco: yangoPrice || undefined,
    hero_eco: heroPrice || undefined,
    tripmaster_eco: tripMasterPrice || undefined,
    status: 'success'
  };

  return res.json(result);
});

// System Status
router.get('/api/system/status', async (_req: Request, res: Response) => {
  const supabase = getSupabaseConfig();
  return res.json({
    status: 'ok',
    storageMode: supabase.url ? 'supabase_cloud_active' : 'local_storage_ready',
    activeCampaigns: activePricingSessions.size,
    totalCampaigns: memoryCampaigns.length + activePricingSessions.size,
    totalNeighborhoods: neighborhoods.length,
    totalCities: cities.length,
    supabaseConfigured: Boolean(supabase.url && supabase.anonKey),
    isQuotaExceeded: false
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
      campaigns: memoryCampaigns
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="citrine_db_full_data_${new Date().toISOString().split('T')[0]}.json"`);
    return res.send(JSON.stringify(fullData, null, 2));
  } catch (e: any) {
    return res.status(500).json({ error: 'Erreur lors de l’export complet de la DB: ' + e.message });
  }
});

export default router;
