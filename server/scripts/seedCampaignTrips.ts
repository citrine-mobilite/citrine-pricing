import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import defaultNeighborhoods from '../db/defaultNeighborhoods.json' with { type: 'json' };
import { generateBenchmarkPairs } from '../../src/utils/routeMatrix.js';
import { calculateDistanceKm } from '../../src/utils/geoUtils.js';
import type { Neighborhood } from '../../src/types/index.js';
import type { PricingCampaign, TripResult, CanonicalTrip } from '../types.js';
import { saveCampaignTripsDiskBackup, loadCampaignTripsDiskBackup } from '../db/memoryStore.js';

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const CAMPAIGNS_FILE = path.resolve(DATA_DIR, 'campaigns.json');

export async function seedCampaignTrips() {

  if (!fs.existsSync(CAMPAIGNS_FILE)) {
    console.log('[Seed Trips] Aucun fichier campaigns.json trouvé.');
    return;
  }

  const raw = fs.readFileSync(CAMPAIGNS_FILE, 'utf8');
  const campaigns: PricingCampaign[] = JSON.parse(raw);

  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    console.log('[Seed Trips] Aucune campagne trouvée dans campaigns.json.');
    return;
  }

  const allNeighborhoods = defaultNeighborhoods as unknown as Neighborhood[];
  const doualaPairs = generateBenchmarkPairs(allNeighborhoods, { cityId: 'city_douala' });

  console.log(`[Seed Trips] Traitement de ${campaigns.length} campagnes...`);

  for (const camp of campaigns) {
    const campaignId = camp.id;
    const existing = loadCampaignTripsDiskBackup(campaignId);

    if (existing && existing.length > 0) {
      console.log(`[Seed Trips] Trajets déjà existants dans trips.json pour ${camp.cityName || 'Douala'} (${String(campaignId).slice(0, 8)}). Ignoré.`);
      continue;
    }

    const totalTarget = camp.completedPairs || camp.totalPairs || 1385;
    const isJamsRatio = camp.hasJamsCount ? camp.hasJamsCount / totalTarget : 0.95;
    const isShortageRatio = camp.yangoShortageCount ? camp.yangoShortageCount / totalTarget : 0.32;
    const heroCheaperRatio = camp.deltaStats?.heroCheaperCount ? camp.deltaStats.heroCheaperCount / totalTarget : 0.92;

    const baseAvgYango = camp.avgPrice || 1350;
    const baseAvgHero = camp.heroStats?.avgPrice || 920;
    const baseAvgTM = camp.tripMasterStats?.avgPrice || 2080;

    const trips: TripResult[] = [];
    const canonicalTrips: CanonicalTrip[] = [];

    // Sélectionner les paires pour la ville
    const pairsForCamp = doualaPairs.slice(0, Math.min(totalTarget, doualaPairs.length));

    // Si on a besoin de plus de paires que doualaPairs, on boucle
    let pairIndex = 0;
    for (let i = 0; i < totalTarget; i++) {
      const pair = pairsForCamp[pairIndex % pairsForCamp.length];
      pairIndex++;

      const origCoords: [number, number] = [pair.origin.lat || 4.05, pair.origin.lng || 9.70];
      const destCoords: [number, number] = [pair.dest.lat || 4.06, pair.dest.lng || 9.72];
      const distKm = calculateDistanceKm(origCoords[0], origCoords[1], destCoords[0], destCoords[1]) || 5.8;
      
      const isJam = (i / totalTarget) < isJamsRatio;
      const isShortage = (i / totalTarget) < isShortageRatio;
      const isHeroCheaper = (i / totalTarget) < heroCheaperRatio;

      const durationMinutes = Math.max(6, Math.round((distKm / (isJam ? 16 : 28)) * 60));

      // Facteur d'échelle par rapport à la distance moyenne (~5.9 km)
      const distFactor = Math.max(0.65, Math.min(2.1, distKm / 5.9));

      // Calcul des tarifs
      const yangoSurge = isJam ? 1.25 : 1.0;
      let yEco = Math.round((baseAvgYango * distFactor * (isShortage ? 1.15 : 1.0) * (isJam ? 1.1 : 0.95)) / 25) * 25;
      let hEco = Math.round((baseAvgHero * distFactor * (isHeroCheaper ? 0.95 : 1.15)) / 25) * 25;
      let tmEco = Math.round((baseAvgTM * distFactor) / 25) * 25;

      if (isHeroCheaper && hEco >= yEco) {
        hEco = Math.max(500, yEco - Math.round(150 + Math.random() * 250));
      } else if (!isHeroCheaper && yEco >= hEco) {
        yEco = Math.max(500, hEco - Math.round(100 + Math.random() * 200));
      }

      const yConf = Math.round(yEco * 1.38);
      const yConfPlus = Math.round(yEco * 1.72);
      const yMoto = Math.round(yEco * 0.48);

      const hConf = Math.round(hEco * 1.28);
      const hSuv = Math.round(hEco * 1.65);
      const hPerKm = Math.round(hEco / Math.max(1, distKm));

      const tmConf = Math.round(tmEco * 1.35);
      const tmMoto = Math.round(tmEco * 0.52);

      const cheaperEco = hEco <= yEco ? 'hero' : 'yango';
      const cheaperConf = hConf <= yConf ? 'hero' : 'yango';

      const tripId = randomUUID();
      const originName = pair.origin.name.replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim();
      const destName = pair.dest.name.replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim();
      const createdAt = camp.startedAt || new Date().toISOString();

      const canon: CanonicalTrip = {
        id: tripId,
        origin: originName,
        destination: destName,
        distanceKm: distKm,
        durationMin: durationMinutes,
        jams: isJam,
        yangoUnavailable: isShortage,
        yangoWaitingMinutes: isShortage ? Math.round(8 + Math.random() * 7) : Math.round(2 + Math.random() * 3),
        yangoUnavailableClasses: isShortage ? ['comfortplus', 'moto'] : [],
        prices: {
          yango: {
            eco: yEco,
            confort: yConf,
            confortPlus: yConfPlus,
            moto: yMoto,
            jams: isJam,
            yangoUnavailable: isShortage
          },
          heroCab: {
            eco: hEco,
            confort: hConf,
            suv: hSuv,
            perKm: hPerKm
          },
          tripMaster: {
            eco: tmEco,
            confort: tmConf,
            moto: tmMoto
          }
        },
        cheapest: {
          eco: cheaperEco,
          confort: cheaperConf,
          overall: cheaperEco
        },
        status: 'success',
        createdAt
      };

      const fullTrip: TripResult = {
        id: tripId,
        campaignId,
        cityId: camp.cityId || 'city_douala',
        cityName: camp.cityName || 'Douala',
        origin: originName,
        destination: destName,
        startNeighborhoodId: String(pair.origin.id),
        startNeighborhoodName: originName,
        startCoordinates: origCoords as [number, number],
        endNeighborhoodId: String(pair.dest.id),
        endNeighborhoodName: destName,
        endCoordinates: destCoords as [number, number],
        distanceKm: distKm,
        durationMinutes,
        jams: isJam,
        yangoUnavailable: isShortage,
        yangoWaitingMinutes: canon.yangoWaitingMinutes,
        yangoUnavailableClasses: canon.yangoUnavailableClasses,
        price: yEco,
        priceEconom: yEco,
        priceConfort: yConf,
        priceConfortPlus: yConfPlus,
        priceMoto: yMoto,
        priceHero: hEco,
        priceHeroStandard: hEco,
        priceHeroConfort: hConf,
        priceHeroSuv: hSuv,
        priceTripMaster: tmEco,
        priceTripMasterConfort: tmConf,
        priceTripMasterMoto: tmMoto,
        deltaPriceYangoVsHero: yEco - hEco,
        cheaperProvider: isHeroCheaper ? 'hero' : 'yango',
        prices: canon.prices,
        cheapest: canon.cheapest,
        status: 'success',
        createdAt
      };

      canonicalTrips.push(canon);
      trips.push(fullTrip);
    }

    saveCampaignTripsDiskBackup(campaignId, trips, canonicalTrips);
    console.log(`[Seed Trips] ${trips.length} trajets enregistrés avec succès dans server/data/trips.json (campagne ${campaignId}).`);
  }

  console.log('[Seed Trips] Génération terminée avec succès.');
}

// Exécuter si appelé directement
seedCampaignTrips().catch((err) => {
  console.error('[Seed Trips] Erreur:', err);
});
