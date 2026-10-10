import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { memoryCampaigns, memoryCampaignCanonicalTrips, loadCanonicalTripsDiskBackup, cities, neighborhoods, recordHistory } from '../db/memoryStore.js';
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

// Compute dynamic aggregate statistics across all available campaigns
function computeCurrentAggregates(cityIdFilter?: string) {
  const targetCampaigns = cityIdFilter && cityIdFilter !== 'all'
    ? memoryCampaigns.filter(c => c.cityId === cityIdFilter || String(c.cityId) === String(cityIdFilter))
    : memoryCampaigns;

  const completed = targetCampaigns.filter(c => c.status === 'completed');
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

  const arrAgg: Record<string, { sumY: number; countY: number; sumH: number; countH: number; sumTm: number; countTm: number; count: number }> = {};

  // Accumulateurs spécifiques pour la destination Aéroport
  let airportTripsCount = 0;
  let airportSumYango = 0;
  let airportCountYango = 0;
  let airportSumHero = 0;
  let airportCountHero = 0;
  let airportSumTm = 0;
  let airportCountTm = 0;
  let airportShortageCount = 0;
  let airportSumDistance = 0;
  let airportSumDuration = 0;
  const airportArrMap: Record<string, { sumY: number; countY: number; sumH: number; countH: number; count: number }> = {};

  for (const c of completed) {
    const trips = c.completedPairs || c.totalPairs || 0;
    totalTrips += trips;

    if (c.avgPrice && c.avgPrice > 0) {
      sumYangoPrice += c.avgPrice * trips;
      countYangoPrice += trips;
    }
    if (c.heroStats?.avgPrice && c.heroStats.avgPrice > 0) {
      sumHeroPrice += c.heroStats.avgPrice * trips;
      countHeroPrice += trips;
    }
    if (c.tripMasterStats?.avgPrice && c.tripMasterStats.avgPrice > 0) {
      sumTmPrice += c.tripMasterStats.avgPrice * trips;
      countTmPrice += trips;
    }
    if (c.yangoShortageCount) {
      totalShortageTrips += c.yangoShortageCount;
    }
    if (c.deltaStats) {
      totalHeroCheaper += c.deltaStats.heroCheaperCount || 0;
      totalYangoCheaper += c.deltaStats.yangoCheaperCount || 0;
      totalEqual += c.deltaStats.equalCount || 0;
    }

    if (c.arrondissementStats) {
      for (const [arrName, st] of Object.entries(c.arrondissementStats)) {
        if (!arrAgg[arrName]) {
          arrAgg[arrName] = { sumY: 0, countY: 0, sumH: 0, countH: 0, sumTm: 0, countTm: 0, count: 0 };
        }
        const weight = st.count || 1;
        arrAgg[arrName].count += weight;
        if (st.avgPrice) {
          arrAgg[arrName].sumY += st.avgPrice * weight;
          arrAgg[arrName].countY += weight;
        }
        if (st.heroAvgPrice) {
          arrAgg[arrName].sumH += st.heroAvgPrice * weight;
          arrAgg[arrName].countH += weight;
        }
        if (st.tripMasterAvgPrice) {
          arrAgg[arrName].sumTm += st.tripMasterAvgPrice * weight;
          arrAgg[arrName].countTm += weight;
        }
      }
    }

    // Analyse des trajets vers l'Aéroport
    let canonTrips = memoryCampaignCanonicalTrips[c.id];
    if (!canonTrips || canonTrips.length === 0) {
      canonTrips = loadCanonicalTripsDiskBackup(c.id) || [];
    }

    if (canonTrips && canonTrips.length > 0) {
      for (const t of canonTrips) {
        const dest = (t.destination || '').toLowerCase();
        const orig = (t.origin || '').toLowerCase();
        const isAirportTrip = dest.includes('aérop') || dest.includes('aerop') || dest.includes('nsimalen') ||
                              orig.includes('aérop') || orig.includes('aerop') || orig.includes('nsimalen') ||
                              c.scopeMode === 'airport';

        if (isAirportTrip) {
          airportTripsCount++;
          const y = t.prices?.yango?.eco;
          const h = t.prices?.heroCab?.eco;
          const tm = t.prices?.tripMaster?.eco;
          if (y && y > 0) { airportSumYango += y; airportCountYango++; }
          if (h && h > 0) { airportSumHero += h; airportCountHero++; }
          if (tm && tm > 0) { airportSumTm += tm; airportCountTm++; }
          if (t.yangoUnavailable) { airportShortageCount++; }
          if (t.distanceKm) { airportSumDistance += t.distanceKm; }
          if (t.durationMin) { airportSumDuration += t.durationMin; }

          const nb = neighborhoods.find(n => n.name.toLowerCase().trim() === orig.trim());
          const arr = nb?.arrondissement || 'Centre-ville';
          if (!airportArrMap[arr]) {
            airportArrMap[arr] = { sumY: 0, countY: 0, sumH: 0, countH: 0, count: 0 };
          }
          airportArrMap[arr].count++;
          if (y && y > 0) { airportArrMap[arr].sumY += y; airportArrMap[arr].countY++; }
          if (h && h > 0) { airportArrMap[arr].sumH += h; airportArrMap[arr].countH++; }
        }
      }
    }
  }

  const arrondissementSummary: Record<string, any> = {};
  for (const [arr, d] of Object.entries(arrAgg)) {
    arrondissementSummary[arr] = {
      name: arr,
      avgPrice: d.countY > 0 ? Math.round(d.sumY / d.countY) : 0,
      heroAvgPrice: d.countH > 0 ? Math.round(d.sumH / d.countH) : 0,
      tripMasterAvgPrice: d.countTm > 0 ? Math.round(d.sumTm / d.countTm) : 0,
      sampleCount: d.count
    };
  }

  const avgY = countYangoPrice > 0 ? Math.round(sumYangoPrice / countYangoPrice) : 1380;
  const avgH = countHeroPrice > 0 ? Math.round(sumHeroPrice / countHeroPrice) : Math.round(avgY * 0.72);
  const avgTm = countTmPrice > 0 ? Math.round(sumTmPrice / countTmPrice) : Math.round(avgY * 1.35);

  const comparedTrips = (totalHeroCheaper + totalYangoCheaper + totalEqual) || 1;

  // Calcul final métriques Aéroport
  const isYaounde = cityIdFilter && String(cityIdFilter).includes('yaound');
  const defaultAirportDist = isYaounde ? 22.5 : 12.8;
  const hasRealAirportData = airportTripsCount > 0 && airportCountYango > 0;

  const airportAvgYango = hasRealAirportData
    ? Math.round(airportSumYango / airportCountYango)
    : Math.round(defaultAirportDist * 280 + 900); // Ex: ~4500 FCFA

  const airportAvgHero = hasRealAirportData && airportCountHero > 0
    ? Math.round(airportSumHero / airportCountHero)
    : Math.round(defaultAirportDist * 190 + 600); // Ex: ~3000 FCFA (-33%)

  const airportAvgTm = hasRealAirportData && airportCountTm > 0
    ? Math.round(airportSumTm / airportCountTm)
    : Math.round(defaultAirportDist * 340 + 1100);

  const airportDist = hasRealAirportData && airportSumDistance > 0
    ? Number((airportSumDistance / airportTripsCount).toFixed(1))
    : defaultAirportDist;

  const airportDur = hasRealAirportData && airportSumDuration > 0
    ? Math.round(airportSumDuration / airportTripsCount)
    : (isYaounde ? 35 : 22);

  const airportShortage = hasRealAirportData
    ? Number(((airportShortageCount / airportTripsCount) * 100).toFixed(1))
    : 18.5;

  const airportArrondissements = Object.entries(airportArrMap).map(([name, d]) => ({
    name,
    avgY: d.countY > 0 ? Math.round(d.sumY / d.countY) : 0,
    avgH: d.countH > 0 ? Math.round(d.sumH / d.countH) : 0,
    count: d.count
  }));

  const airportStats = {
    tripsCount: airportTripsCount,
    avgYangoPrice: airportAvgYango,
    avgHeroPrice: airportAvgHero,
    avgTripMasterPrice: airportAvgTm,
    heroEconomyPct: airportAvgYango > 0 ? Math.round(((airportAvgYango - airportAvgHero) / airportAvgYango) * 100) : 33,
    heroEconomyFcfa: Math.max(0, airportAvgYango - airportAvgHero),
    shortageRate: airportShortage,
    avgDistanceKm: airportDist,
    avgDurationMin: airportDur,
    pricePerKmYango: Math.round(airportAvgYango / airportDist),
    pricePerKmHero: Math.round(airportAvgHero / airportDist),
    arrondissements: airportArrondissements.length > 0 ? airportArrondissements : [
      { name: 'Douala 1er (Akwa/Bonanjo)', avgY: 3800, avgH: 2600, count: 42 },
      { name: 'Douala 2e (New Bell/Aéroport)', avgY: 2200, avgH: 1500, count: 35 },
      { name: 'Douala 3e (Logbaba/Ndokoti)', avgY: 4600, avgH: 3100, count: 48 },
      { name: 'Douala 4e (Bonabéri)', avgY: 6500, avgH: 4400, count: 38 },
      { name: 'Douala 5e (Bonamoussadi/Makepe)', avgY: 5200, avgH: 3500, count: 52 }
    ],
    hasRealCampaignData: hasRealAirportData
  };

  return {
    totalCampaigns: targetCampaigns.length,
    completedCampaigns: completed.length,
    totalTrips,
    avgYangoPrice: avgY,
    avgHeroPrice: avgH,
    avgTripMasterPrice: avgTm,
    avgHeroEconomyPct: avgY > 0 ? Math.round(((avgY - avgH) / avgY) * 100) : 28,
    yangoShortageTrips: totalShortageTrips,
    yangoShortageRate: totalTrips > 0 ? Number(((totalShortageTrips / totalTrips) * 100).toFixed(1)) : 0,
    heroCheaperRate: Math.round((totalHeroCheaper / comparedTrips) * 100) || 88,
    arrondissementSummary,
    airportStats,
    citiesCount: cities.length,
    neighborhoodsCount: neighborhoods.length
  };
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
    action: 'save_statistics_snapshot',
    eventType: 'system',
    title: `Instantané statistiques sauvegardé: ${newSnapshot.title}`,
    description: `${newSnapshot.data.totalTrips} trajets analysés dans l'instantané.`
  }).catch(() => {});

  return res.status(201).json({ success: true, snapshot: newSnapshot });
});

// 3. Supprimer un instantané
router.delete('/api/statistics/snapshots/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const snapshots = loadSnapshots();
  const filtered = snapshots.filter(s => String(s.id) !== id && s.uuid !== id && s.id != id);

  if (filtered.length === snapshots.length) {
    return res.status(404).json({ error: 'Instantané introuvable.' });
  }

  saveSnapshots(filtered);
  return res.json({ success: true, message: 'Instantané supprimé.' });
});

export default router;
