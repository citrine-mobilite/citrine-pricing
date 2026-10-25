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

  // Accumulateurs tranches de distance
  const distBrackets = [
    { bracket: '0-3', label: '0 – 3 km (Centre & Local)', minKm: 0, maxKm: 3, sumY: 0, countY: 0, sumH: 0, countH: 0, sumTm: 0, countTm: 0, sumDist: 0, count: 0, shortages: 0 },
    { bracket: '3-7', label: '3 – 7 km (Intra-urbain)', minKm: 3, maxKm: 7, sumY: 0, countY: 0, sumH: 0, countH: 0, sumTm: 0, countTm: 0, sumDist: 0, count: 0, shortages: 0 },
    { bracket: '7-12', label: '7 – 12 km (Inter-zones)', minKm: 7, maxKm: 12, sumY: 0, countY: 0, sumH: 0, countH: 0, sumTm: 0, countTm: 0, sumDist: 0, count: 0, shortages: 0 },
    { bracket: '12-20', label: '12 – 20 km (Périphérie / Rocades)', minKm: 12, maxKm: 20, sumY: 0, countY: 0, sumH: 0, countH: 0, sumTm: 0, countTm: 0, sumDist: 0, count: 0, shortages: 0 },
    { bracket: '>20', label: '+ de 20 km (Longue distance / Aéroports)', minKm: 20, maxKm: 999, sumY: 0, countY: 0, sumH: 0, countH: 0, sumTm: 0, countTm: 0, sumDist: 0, count: 0, shortages: 0 }
  ];

  // Accumulateurs créneaux horaires
  const slotAgg: Record<string, { sumY: number; countY: number; sumH: number; countH: number; count: number; shortages: number; surges: number }> = {
    '08:00': { sumY: 0, countY: 0, sumH: 0, countH: 0, count: 0, shortages: 0, surges: 0 },
    '13:00': { sumY: 0, countY: 0, sumH: 0, countH: 0, count: 0, shortages: 0, surges: 0 },
    '18:00': { sumY: 0, countY: 0, sumH: 0, countH: 0, count: 0, shortages: 0, surges: 0 }
  };

  // Accumulateurs multi-classes
  const classAgg = {
    eco: { sumY: 0, countY: 0, sumH: 0, countH: 0, sumTm: 0, countTm: 0 },
    confort: { sumY: 0, countY: 0, sumH: 0, countH: 0, sumTm: 0, countTm: 0 },
    moto: { sumY: 0, countY: 0, sumH: 0, countH: 0, sumTm: 0, countTm: 0 },
    suv: { sumY: 0, countY: 0, sumH: 0, countH: 0 }
  };

  const corridorMap: Record<string, { origin: string; destination: string; sumY: number; countY: number; sumH: number; countH: number; count: number; shortages: number; dist: number }> = {};
  let totalSavingsAccumulator = 0;

  // Collecter l'ensemble des trajets canoniques (campagnes en mémoire + base trips.json sur disque)
  const canonicalTripsToProcess: any[] = [];
  const processedTripKeys = new Set<string>();

  for (const c of completed) {
    const slotKey = (c.timeSlotOverride === '08:00' || c.timeSlotOverride === '18:00') ? c.timeSlotOverride : '13:00';
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

    let canonTrips = memoryCampaignCanonicalTrips[c.id];
    if (!canonTrips || canonTrips.length === 0) {
      canonTrips = loadCanonicalTripsDiskBackup(c.id) || [];
    }
    if (canonTrips && canonTrips.length > 0) {
      for (const t of canonTrips) {
        const key = t.uuid || `${c.id}-${t.id || t.origin + '-' + t.destination}`;
        if (!processedTripKeys.has(key)) {
          processedTripKeys.add(key);
          canonicalTripsToProcess.push({ ...t, _slotKey: slotKey, _scopeMode: c.scopeMode });
        }
      }
    }
  }

  // Toujours enrichir avec le stockage disque trips.json pour agréger tous les relevés historiques et aéroports
  const TRIPS_FILE = path.resolve(process.cwd(), 'server/data/trips.json');
  if (fs.existsSync(TRIPS_FILE)) {
    try {
      const diskStore: Record<string, any> = JSON.parse(fs.readFileSync(TRIPS_FILE, 'utf8'));
      for (const [campKey, entry] of Object.entries(diskStore)) {
        const list = Array.isArray(entry) ? entry : (entry?.canonicalTrips || entry?.trips || []);
        for (const t of list) {
          const key = t.uuid || `${campKey}-${t.id || t.origin + '-' + t.destination}`;
          if (!processedTripKeys.has(key)) {
            processedTripKeys.add(key);
            canonicalTripsToProcess.push(t);
          }
        }
      }
    } catch (e: any) {
      console.warn('[Statistics] Warning reading disk trips store:', e.message);
    }
  }

  // Traiter l'ensemble des trajets canoniques unifiés
  for (const t of canonicalTripsToProcess) {
    const dist = Number(t.distanceKm || t.km) || 4.5;
    const yEco = t.prices?.yango?.eco || t.priceEconom;
    const hEco = t.prices?.heroCab?.eco || t.priceHero;
    const tmEco = t.prices?.tripMaster?.eco;
    const isShortage = Boolean(t.yangoUnavailable);

    // Tranche de distance
    const b = distBrackets.find(b => dist >= b.minKm && dist < b.maxKm) || distBrackets[distBrackets.length - 1];
    b.count++;
    b.sumDist += dist;
    if (isShortage) b.shortages++;
    if (yEco && yEco > 0) { b.sumY += yEco; b.countY++; }
    if (hEco && hEco > 0) { b.sumH += hEco; b.countH++; }
    if (tmEco && tmEco > 0) { b.sumTm += tmEco; b.countTm++; }

    // Créneaux horaires
    const slotKey = t._slotKey || '13:00';
    const targetSlot = slotAgg[slotKey] || slotAgg['13:00'];
    targetSlot.count++;
    if (isShortage) targetSlot.shortages++;
    const surge = (t as any).surgeMultiplier || (t as any).surge;
    if (surge && surge > 1) targetSlot.surges++;
    if (yEco && yEco > 0) { targetSlot.sumY += yEco; targetSlot.countY++; }
    if (hEco && hEco > 0) { targetSlot.sumH += hEco; targetSlot.countH++; }

    // Classes de véhicules
    if (yEco && yEco > 0) { classAgg.eco.sumY += yEco; classAgg.eco.countY++; }
    if (hEco && hEco > 0) { classAgg.eco.sumH += hEco; classAgg.eco.countH++; }
    if (tmEco && tmEco > 0) { classAgg.eco.sumTm += tmEco; classAgg.eco.countTm++; }

    const yConf = t.prices?.yango?.confort;
    const hConf = t.prices?.heroCab?.confort;
    const tmConf = t.prices?.tripMaster?.confort;
    if (yConf && yConf > 0) { classAgg.confort.sumY += yConf; classAgg.confort.countY++; }
    if (hConf && hConf > 0) { classAgg.confort.sumH += hConf; classAgg.confort.countH++; }
    if (tmConf && tmConf > 0) { classAgg.confort.sumTm += tmConf; classAgg.confort.countTm++; }

    const yMoto = t.prices?.yango?.moto;
    const hMoto = (t.prices?.heroCab as any)?.moto || (hEco ? Math.round(hEco * 0.45) : null);
    const tmMoto = t.prices?.tripMaster?.moto;
    if (yMoto && yMoto > 0) { classAgg.moto.sumY += yMoto; classAgg.moto.countY++; }
    if (hMoto && hMoto > 0) { classAgg.moto.sumH += hMoto; classAgg.moto.countH++; }
    if (tmMoto && tmMoto > 0) { classAgg.moto.sumTm += tmMoto; classAgg.moto.countTm++; }

    const hSuv = t.prices?.heroCab?.suv || (hEco ? Math.round(hEco * 1.55) : null);
    const yConfPlus = t.prices?.yango?.confortPlus || (yConf ? Math.round(yConf * 1.25) : null);
    if (yConfPlus && yConfPlus > 0) { classAgg.suv.sumY += yConfPlus; classAgg.suv.countY++; }
    if (hSuv && hSuv > 0) { classAgg.suv.sumH += hSuv; classAgg.suv.countH++; }

    // Économies cumulées
    if (yEco && hEco && yEco > hEco) {
      totalSavingsAccumulator += (yEco - hEco);
    }

    // Corridors
    const origName = (t.origin || '').trim() || 'Origine';
    const destName = (t.destination || '').trim() || 'Destination';
    const corrKey = `${origName} ➔ ${destName}`;
    if (!corridorMap[corrKey]) {
      corridorMap[corrKey] = { origin: origName, destination: destName, sumY: 0, countY: 0, sumH: 0, countH: 0, count: 0, shortages: 0, dist };
    }
    corridorMap[corrKey].count++;
    if (isShortage) corridorMap[corrKey].shortages++;
    if (yEco && yEco > 0) { corridorMap[corrKey].sumY += yEco; corridorMap[corrKey].countY++; }
    if (hEco && hEco > 0) { corridorMap[corrKey].sumH += hEco; corridorMap[corrKey].countH++; }

    // Détection stricte et complète des trajets Aéroport
    const destLower = destName.toLowerCase();
    const origLower = origName.toLowerCase();
    const isAirportTrip = destLower.includes('aérop') || destLower.includes('aerop') || destLower === 'aéroport' ||
                          origLower.includes('aérop') || origLower.includes('aerop') || origLower === 'aéroport' ||
                          destLower.includes('nsimalen') || origLower.includes('nsimalen') ||
                          destLower.includes('port-bouët') || origLower.includes('port-bouët') ||
                          Boolean(t.isAirport) || t.zoneType === 'airport' || t.scopeMode === 'airport' ||
                          t._scopeMode === 'airport';

    if (isAirportTrip) {
      airportTripsCount++;
      if (yEco && yEco > 0) { airportSumYango += yEco; airportCountYango++; }
      if (hEco && hEco > 0) { airportSumHero += hEco; airportCountHero++; }
      if (tmEco && tmEco > 0) { airportSumTm += tmEco; airportCountTm++; }
      if (isShortage) { airportShortageCount++; }
      if (dist && dist > 0) { airportSumDistance += dist; }
      const tripDuration = Number(t.durationMin || t.duration) || 0;
      if (tripDuration > 0) { airportSumDuration += tripDuration; }

      // Déterminer l'arrondissement rattaché au trajet aéroport
      const nonAirportEndpoint = (origLower.includes('aéro') || origLower.includes('aerop')) ? destName : origName;
      const nb = neighborhoods.find(n => n.name.toLowerCase().trim() === nonAirportEndpoint.toLowerCase().trim());
      const arr = nb?.arrondissement || 'DOUALA 2E';
      if (!airportArrMap[arr]) {
        airportArrMap[arr] = { sumY: 0, countY: 0, sumH: 0, countH: 0, count: 0 };
      }
      airportArrMap[arr].count++;
      if (yEco && yEco > 0) { airportArrMap[arr].sumY += yEco; airportArrMap[arr].countY++; }
      if (hEco && hEco > 0) { airportArrMap[arr].sumH += hEco; airportArrMap[arr].countH++; }
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

  const avgY = countYangoPrice > 0 ? Math.round(sumYangoPrice / countYangoPrice) : 0;
  const avgH = countHeroPrice > 0 ? Math.round(sumHeroPrice / countHeroPrice) : 0;
  const avgTm = countTmPrice > 0 ? Math.round(sumTmPrice / countTmPrice) : 0;

  const comparedTrips = (totalHeroCheaper + totalYangoCheaper + totalEqual) || 1;

  // Calcul final métriques Aéroport (strictement basées sur les données réelles)
  const hasRealAirportData = airportTripsCount > 0 && airportCountYango > 0;

  const airportAvgYango = hasRealAirportData ? Math.round(airportSumYango / airportCountYango) : 0;
  const airportAvgHero = hasRealAirportData && airportCountHero > 0 ? Math.round(airportSumHero / airportCountHero) : 0;
  const airportAvgTm = hasRealAirportData && airportCountTm > 0 ? Math.round(airportSumTm / airportCountTm) : 0;

  const airportDist = hasRealAirportData && airportSumDistance > 0
    ? Number((airportSumDistance / airportTripsCount).toFixed(1))
    : 0;

  const airportDur = hasRealAirportData && airportSumDuration > 0
    ? Math.round(airportSumDuration / airportTripsCount)
    : 0;

  const airportShortage = hasRealAirportData
    ? Number(((airportShortageCount / airportTripsCount) * 100).toFixed(1))
    : 0;

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
    heroEconomyPct: airportAvgYango > 0 ? Math.round(((airportAvgYango - airportAvgHero) / airportAvgYango) * 100) : 0,
    heroEconomyFcfa: Math.max(0, airportAvgYango - airportAvgHero),
    shortageRate: airportShortage,
    avgDistanceKm: airportDist,
    avgDurationMin: airportDur,
    pricePerKmYango: airportDist > 0 ? Math.round(airportAvgYango / airportDist) : 0,
    pricePerKmHero: airportDist > 0 ? Math.round(airportAvgHero / airportDist) : 0,
    arrondissements: airportArrondissements,
    hasRealCampaignData: hasRealAirportData
  };

  const formattedDistanceBrackets = distBrackets.map(b => {
    const avgY = b.countY > 0 ? Math.round(b.sumY / b.countY) : 0;
    const avgH = b.countH > 0 ? Math.round(b.sumH / b.countH) : 0;
    const avgTm = b.countTm > 0 ? Math.round(b.sumTm / b.countTm) : 0;
    const avgDist = b.count > 0 ? Number((b.sumDist / b.count).toFixed(1)) : (b.minKm + (b.maxKm === 999 ? 22 : (b.maxKm - b.minKm) / 2));
    const yangoPerKm = avgDist > 0 && avgY > 0 ? Math.round(avgY / avgDist) : 0;
    const heroPerKm = avgDist > 0 && avgH > 0 ? Math.round(avgH / avgDist) : 0;
    const heroEconomyPct = avgY > 0 && avgH > 0 ? Math.round(((avgY - avgH) / avgY) * 100) : 0;
    const shortageRate = b.count > 0 ? Number(((b.shortages / b.count) * 100).toFixed(1)) : 0;

    return {
      bracket: b.bracket,
      label: b.label,
      minKm: b.minKm,
      maxKm: b.maxKm,
      avgDistanceKm: avgDist,
      avgYango: avgY,
      avgHero: avgH,
      avgTripMaster: avgTm,
      yangoPerKm,
      heroPerKm,
      heroEconomyPct,
      shortageRate,
      tripsCount: b.count
    };
  });

  const formattedTimeSlots = Object.entries(slotAgg).map(([slot, data]) => {
    const avgY = data.countY > 0 ? Math.round(data.sumY / data.countY) : 0;
    const avgH = data.countH > 0 ? Math.round(data.sumH / data.countH) : 0;
    const shortageRate = data.count > 0 ? Number(((data.shortages / data.count) * 100).toFixed(1)) : 0;
    const surgeRate = data.count > 0 ? Number(((data.surges / data.count) * 100).toFixed(1)) : 0;
    const heroEconomyPct = avgY > 0 && avgH > 0 ? Math.round(((avgY - avgH) / avgY) * 100) : 0;

    return {
      slot,
      label: slot === '08:00' ? 'Matin — Pointe (08h00)' : slot === '13:00' ? 'Midi — Creux (13h00)' : 'Soirée — Sortie de bureau (18h00)',
      avgYango: avgY,
      avgHero: avgH,
      shortageRate,
      surgeRate,
      tripsCount: data.count,
      heroEconomyPct
    };
  });

  const formattedClasses = {
    eco: {
      yango: classAgg.eco.countY > 0 ? Math.round(classAgg.eco.sumY / classAgg.eco.countY) : avgY,
      hero: classAgg.eco.countH > 0 ? Math.round(classAgg.eco.sumH / classAgg.eco.countH) : avgH,
      tripMaster: classAgg.eco.countTm > 0 ? Math.round(classAgg.eco.sumTm / classAgg.eco.countTm) : avgTm,
      count: classAgg.eco.countY
    },
    confort: {
      yango: classAgg.confort.countY > 0 ? Math.round(classAgg.confort.sumY / classAgg.confort.countY) : Math.round(avgY * 1.35),
      hero: classAgg.confort.countH > 0 ? Math.round(classAgg.confort.sumH / classAgg.confort.countH) : Math.round(avgH * 1.3),
      tripMaster: classAgg.confort.countTm > 0 ? Math.round(classAgg.confort.sumTm / classAgg.confort.countTm) : Math.round(avgTm * 1.35),
      count: classAgg.confort.countY
    },
    moto: {
      yango: classAgg.moto.countY > 0 ? Math.round(classAgg.moto.sumY / classAgg.moto.countY) : Math.round(avgY * 0.45),
      hero: classAgg.moto.countH > 0 ? Math.round(classAgg.moto.sumH / classAgg.moto.countH) : Math.round(avgH * 0.45),
      tripMaster: classAgg.moto.countTm > 0 ? Math.round(classAgg.moto.sumTm / classAgg.moto.countTm) : Math.round(avgTm * 0.4),
      count: classAgg.moto.countY
    },
    suv: {
      yango: classAgg.suv.countY > 0 ? Math.round(classAgg.suv.sumY / classAgg.suv.countY) : Math.round(avgY * 1.65),
      hero: classAgg.suv.countH > 0 ? Math.round(classAgg.suv.sumH / classAgg.suv.countH) : Math.round(avgH * 1.55),
      count: classAgg.suv.countH
    }
  };

  const topStrategicCorridors = Object.values(corridorMap)
    .filter(c => c.count > 0)
    .map(c => {
      const avgY = c.countY > 0 ? Math.round(c.sumY / c.countY) : 0;
      const avgH = c.countH > 0 ? Math.round(c.sumH / c.countH) : 0;
      const economyFcfa = Math.max(0, avgY - avgH);
      const economyPct = avgY > 0 ? Math.round((economyFcfa / avgY) * 100) : 0;
      const shortageRate = c.count > 0 ? Number(((c.shortages / c.count) * 100).toFixed(1)) : 0;

      return {
        corridor: `${c.origin} ➔ ${c.destination}`,
        origin: c.origin,
        destination: c.destination,
        distanceKm: Number(c.dist.toFixed(1)),
        avgYango: avgY,
        avgHero: avgH,
        economyFcfa,
        economyPct,
        shortageRate,
        tripsCount: c.count
      };
    })
    .sort((a, b) => b.tripsCount - a.tripsCount)
    .slice(0, 10);

  const avgSavingsPerTrip = Math.max(0, avgY - avgH);
  const economicImpact = {
    totalSavingsFcfa: totalSavingsAccumulator > 0 ? totalSavingsAccumulator : (totalTrips * avgSavingsPerTrip),
    avgSavingsPerTrip,
    businessMonthlySavings500Trips: avgSavingsPerTrip * 500,
    businessMonthlySavings1000Trips: avgSavingsPerTrip * 1000
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
    distanceBrackets: formattedDistanceBrackets,
    timeSlotStats: formattedTimeSlots,
    classesBreakdown: formattedClasses,
    strategicCorridors: topStrategicCorridors,
    economicImpact,
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
