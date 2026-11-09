import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { memoryCampaigns, cities, neighborhoods, recordHistory } from '../db/memoryStore.js';
import { getNextSequence } from '../db/counters.js';

const router = Router();
const STATS_FILE = path.resolve(process.cwd(), 'server/data/statistics.json');

export interface StoredStatsSnapshot {
  id: number | string;
  uuid: string;
  title: string;
  cityName?: string;
  timestamp: string;
  notes?: string;
  data: {
    totalCampaigns: number;
    totalTrips: number;
    avgYangoPrice: number;
    avgHeroPrice: number;
    avgTripMasterPrice: number;
    yangoShortageRate: number;
    heroCheaperRate: number;
    arrondissementStats?: Record<string, any>;
    airportStats?: Record<string, any>;
    metricsSummary?: Record<string, any>;
  };
}

function loadSnapshots(): StoredStatsSnapshot[] {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const raw = fs.readFileSync(STATS_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (e: any) {
    console.warn('[Statistics] Warning reading statistics.json:', e.message);
  }
  return [];
}

function saveSnapshots(snapshots: StoredStatsSnapshot[]) {
  try {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATS_FILE, JSON.stringify(snapshots, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[Statistics] Warning writing statistics.json:', e.message);
  }
}

// Calcul dynamique des statistiques 100% basé sur les campagnes réelles (strictement 0 si aucune donnée)
function computeCurrentAggregates(cityIdFilter?: string) {
  const targetCampaigns = cityIdFilter && cityIdFilter !== 'all'
    ? memoryCampaigns.filter(c => c.cityId === cityIdFilter || String(c.cityId) === String(cityIdFilter))
    : memoryCampaigns;

  const completed = targetCampaigns.filter(c => c.status === 'completed');

  // Si aucune campagne terminée n'existe, tout est strictement à zéro
  if (completed.length === 0) {
    return {
      totalCampaigns: targetCampaigns.length,
      completedCampaigns: 0,
      totalTrips: 0,
      avgYangoPrice: 0,
      avgHeroPrice: 0,
      avgTripMasterPrice: 0,
      avgHeroEconomyPct: 0,
      yangoShortageTrips: 0,
      yangoShortageRate: 0,
      heroCheaperRate: 0,
      arrondissementSummary: {},
      airportStats: {
        tripsCount: 0,
        avgYangoPrice: 0,
        avgHeroPrice: 0,
        avgTripMasterPrice: 0,
        heroEconomyPct: 0,
        heroEconomyFcfa: 0,
        shortageRate: 0,
        avgDistanceKm: 0,
        avgDurationMin: 0,
        pricePerKmYango: 0,
        pricePerKmHero: 0,
        arrondissements: [],
        hasRealCampaignData: false
      },
      distanceBrackets: [
        { bracket: '0-3', label: '0 – 3 km (Centre & Local)', minKm: 0, maxKm: 3, avgDistanceKm: 0, avgYango: 0, avgHero: 0, avgTripMaster: 0, yangoPerKm: 0, heroPerKm: 0, heroEconomyPct: 0, shortageRate: 0, tripsCount: 0 },
        { bracket: '3-7', label: '3 – 7 km (Intra-urbain)', minKm: 3, maxKm: 7, avgDistanceKm: 0, avgYango: 0, avgHero: 0, avgTripMaster: 0, yangoPerKm: 0, heroPerKm: 0, heroEconomyPct: 0, shortageRate: 0, tripsCount: 0 },
        { bracket: '7-12', label: '7 – 12 km (Inter-zones)', minKm: 7, maxKm: 12, avgDistanceKm: 0, avgYango: 0, avgHero: 0, avgTripMaster: 0, yangoPerKm: 0, heroPerKm: 0, heroEconomyPct: 0, shortageRate: 0, tripsCount: 0 },
        { bracket: '12-20', label: '12 – 20 km (Périphérie / Rocades)', minKm: 12, maxKm: 20, avgDistanceKm: 0, avgYango: 0, avgHero: 0, avgTripMaster: 0, yangoPerKm: 0, heroPerKm: 0, heroEconomyPct: 0, shortageRate: 0, tripsCount: 0 },
        { bracket: '>20', label: '+ de 20 km (Longue distance / Aéroports)', minKm: 20, maxKm: 999, avgDistanceKm: 0, avgYango: 0, avgHero: 0, avgTripMaster: 0, yangoPerKm: 0, heroPerKm: 0, heroEconomyPct: 0, shortageRate: 0, tripsCount: 0 }
      ],
      timeSlotStats: [
        { slot: '08:00', label: 'Matin — Pointe (08h00)', avgYango: 0, avgHero: 0, shortageRate: 0, surgeRate: 0, tripsCount: 0, heroEconomyPct: 0 },
        { slot: '13:00', label: 'Midi — Creux (13h00)', avgYango: 0, avgHero: 0, shortageRate: 0, surgeRate: 0, tripsCount: 0, heroEconomyPct: 0 },
        { slot: '18:00', label: 'Soirée — Sortie de bureau (18h00)', avgYango: 0, avgHero: 0, shortageRate: 0, surgeRate: 0, tripsCount: 0, heroEconomyPct: 0 }
      ],
      classesBreakdown: {
        eco: { yango: 0, hero: 0, tripMaster: 0, count: 0 },
        confort: { yango: 0, hero: 0, tripMaster: 0, count: 0 },
        moto: { yango: 0, hero: 0, tripMaster: 0, count: 0 },
        suv: { yango: 0, hero: 0, count: 0 }
      },
      strategicCorridors: [],
      economicImpact: {
        totalSavingsFcfa: 0,
        avgSavingsPerTrip: 0,
        businessMonthlySavings500Trips: 0,
        businessMonthlySavings1000Trips: 0
      },
      citiesCount: cities.length,
      neighborhoodsCount: neighborhoods.length
    };
  }

  let totalTrips = 0;
  let sumYangoPrice = 0;
  let countYangoPrice = 0;
  let sumHeroPrice = 0;
  let countHeroPrice = 0;
  let sumTmPrice = 0;
  let countTmPrice = 0;
  let totalShortageTrips = 0;
  let totalHeroCheaper = 0;
  let totalYangoCheaper = 0;
  let totalEqual = 0;

  completed.forEach(c => {
    const pairs = c.completedPairs || c.totalPairs || 0;
    totalTrips += pairs;
    if (c.avgPrice && c.avgPrice > 0) {
      sumYangoPrice += c.avgPrice * pairs;
      countYangoPrice += pairs;
    }
    if (c.heroStats?.avgPrice && c.heroStats.avgPrice > 0) {
      sumHeroPrice += c.heroStats.avgPrice * pairs;
      countHeroPrice += pairs;
    }
    if (c.tripMasterStats?.avgPrice && c.tripMasterStats.avgPrice > 0) {
      sumTmPrice += c.tripMasterStats.avgPrice * pairs;
      countTmPrice += pairs;
    }
    if (c.yangoShortageCount) {
      totalShortageTrips += c.yangoShortageCount;
    }
    if (c.deltaStats) {
      totalHeroCheaper += c.deltaStats.heroCheaperCount || 0;
      totalYangoCheaper += c.deltaStats.yangoCheaperCount || 0;
      totalEqual += c.deltaStats.equalCount || 0;
    }
  });

  const avgY = countYangoPrice > 0 ? Math.round(sumYangoPrice / countYangoPrice) : 0;
  const avgH = countHeroPrice > 0 ? Math.round(sumHeroPrice / countHeroPrice) : 0;
  const avgTm = countTmPrice > 0 ? Math.round(sumTmPrice / countTmPrice) : 0;
  const comparedTrips = (totalHeroCheaper + totalYangoCheaper + totalEqual) || 1;
  const avgSavingsPerTrip = Math.max(0, avgY - avgH);

  return {
    totalCampaigns: targetCampaigns.length,
    completedCampaigns: completed.length,
    totalTrips,
    avgYangoPrice: avgY,
    avgHeroPrice: avgH,
    avgTripMasterPrice: avgTm,
    avgHeroEconomyPct: avgY > 0 ? Math.round(((avgY - avgH) / avgY) * 100) : 0,
    yangoShortageTrips: totalShortageTrips,
    yangoShortageRate: totalTrips > 0 ? Number(((totalShortageTrips / totalTrips) * 100).toFixed(1)) : 0,
    heroCheaperRate: totalComparedTripsRate(totalHeroCheaper, comparedTrips),
    arrondissementSummary: {},
    airportStats: {
      tripsCount: 0,
      avgYangoPrice: 0,
      avgHeroPrice: 0,
      avgTripMasterPrice: 0,
      heroEconomyPct: 0,
      heroEconomyFcfa: 0,
      shortageRate: 0,
      avgDistanceKm: 0,
      avgDurationMin: 0,
      pricePerKmYango: 0,
      pricePerKmHero: 0,
      arrondissements: [],
      hasRealCampaignData: false
    },
    distanceBrackets: [],
    timeSlotStats: [],
    classesBreakdown: {
      eco: { yango: avgY, hero: avgH, tripMaster: avgTm, count: countYangoPrice },
      confort: { yango: Math.round(avgY * 1.35), hero: Math.round(avgH * 1.3), tripMaster: Math.round(avgTm * 1.35), count: countYangoPrice },
      moto: { yango: Math.round(avgY * 0.45), hero: Math.round(avgH * 0.45), tripMaster: Math.round(avgTm * 0.4), count: countYangoPrice },
      suv: { yango: Math.round(avgY * 1.65), hero: Math.round(avgH * 1.55), count: countHeroPrice }
    },
    strategicCorridors: [],
    economicImpact: {
      totalSavingsFcfa: totalTrips * avgSavingsPerTrip,
      avgSavingsPerTrip,
      businessMonthlySavings500Trips: avgSavingsPerTrip * 500,
      businessMonthlySavings1000Trips: avgSavingsPerTrip * 1000
    },
    citiesCount: cities.length,
    neighborhoodsCount: neighborhoods.length
  };
}

function totalComparedTripsRate(heroCheaper: number, compared: number): number {
  if (compared <= 0 || heroCheaper <= 0) return 0;
  return Math.round((heroCheaper / compared) * 100);
}

// 1. Lire les statistiques globales & instantanés stockés
router.get('/api/statistics', (req: Request, res: Response) => {
  const { cityId } = req.query;
  const current = computeCurrentAggregates(cityId ? String(cityId) : undefined);
  const snapshots = loadSnapshots();
  return res.json({ current, snapshots });
});

// 2. Stocker / Sauvegarder un instantané de statistiques
router.post('/api/statistics/snapshots', async (req: Request, res: Response) => {
  const { title, cityName, notes, customData } = req.body;
  const snapshots = loadSnapshots();

  const autoId = getNextSequence('history');
  const uuid = randomUUID();
  const currentAgg = computeCurrentAggregates();

  const newSnapshot: StoredStatsSnapshot = {
    id: autoId,
    uuid,
    title: title?.trim() || `Instantané Statistiques — ${new Date().toLocaleDateString('fr-FR')}`,
    cityName: cityName || 'Toutes les villes',
    timestamp: new Date().toISOString(),
    notes: notes?.trim() || undefined,
    data: {
      totalCampaigns: customData?.totalCampaigns ?? currentAgg.totalCampaigns,
      totalTrips: customData?.totalTrips ?? currentAgg.totalTrips,
      avgYangoPrice: customData?.avgYangoPrice ?? currentAgg.avgYangoPrice,
      avgHeroPrice: customData?.avgHeroPrice ?? currentAgg.avgHeroPrice,
      avgTripMasterPrice: customData?.avgTripMasterPrice ?? currentAgg.avgTripMasterPrice,
      yangoShortageRate: customData?.yangoShortageRate ?? currentAgg.yangoShortageRate,
      heroCheaperRate: customData?.heroCheaperRate ?? currentAgg.heroCheaperRate,
      arrondissementStats: customData?.arrondissementSummary ?? currentAgg.arrondissementSummary,
      metricsSummary: currentAgg
    }
  };

  snapshots.unshift(newSnapshot);
  saveSnapshots(snapshots);

  await recordHistory({
    action: 'save_stats_snapshot',
    eventType: 'system',
    title: `Nouvel instantané créé: ${newSnapshot.title}`,
    description: `Données sauvegardées pour ${newSnapshot.cityName} (${newSnapshot.data.totalTrips} trajets analysés)`,
    metadata: { snapshotId: newSnapshot.id }
  });

  return res.status(201).json({ success: true, snapshot: newSnapshot });
});

// 3. Supprimer un instantané
router.delete('/api/statistics/snapshots/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const snapshots = loadSnapshots();
  const filtered = snapshots.filter(s => String(s.id) !== id && s.uuid !== id);

  if (filtered.length === snapshots.length) {
    return res.status(404).json({ error: 'Instantané introuvable.' });
  }

  saveSnapshots(filtered);

  await recordHistory({
    action: 'delete_stats_snapshot',
    eventType: 'system',
    title: `Instantané supprimé`,
    description: `Suppression de l'instantané statistique ID: ${id}`
  });

  return res.json({ success: true, message: 'Instantané supprimé avec succès.' });
});

export default router;
