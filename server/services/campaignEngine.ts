import { randomUUID } from 'crypto';
import { doc, setDoc } from 'firebase/firestore';
import { City, Neighborhood, PricingCampaign, TripResult, CanonicalTrip, CanonicalTripPrices } from '../types.js';
import { db, cleanFirestoreDoc, safeFirestoreWrite, saveCanonicalCampaignResults } from '../db/firestore.js';
import {
  activePricingSessions,
  memoryCampaigns,
  memoryCampaignTrips,
  memoryCampaignCanonicalTrips,
  recordHistory
} from '../db/memoryStore.js';
import { callYangoRoutestats, calculateDistanceKm } from './yangoService.js';
import { callHeroStats } from './heroService.js';
import { callTripMasterStats } from './tripMasterService.js';

export function cleanNeighborhoodName(name: string | null | undefined): string {
  if (!name) return '—';
  return name.replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim();
}

/**
 * Lance l'exécution asynchrone d'une campagne de tarification
 */
export async function startCampaignExecution(
  campaign: PricingCampaign,
  city: City,
  pairs: Array<{ origin: Neighborhood; dest: Neighborhood }>,
  isTestSample: boolean = false
) {
  const campaignId = campaign.id;
  const abortController = new AbortController();

  const localCanonicalTrips: CanonicalTrip[] = [];
  const localTrips: TripResult[] = [];

  activePricingSessions.set(campaignId, {
    campaign,
    trips: localTrips,
    canonicalTrips: localCanonicalTrips,
    abortController,
    cancelled: false
  });

  // Découpage en lots
  const LOT_SIZE = 10;
  const NUM_PARALLEL_WORKERS = Math.min(6, Math.max(2, Math.ceil(pairs.length / 50)));
  const chunks: Array<{ chunkIndex: number; totalChunks: number; pairs: Array<{ origin: Neighborhood; dest: Neighborhood }> }> = [];

  for (let i = 0; i < pairs.length; i += LOT_SIZE) {
    chunks.push({
      chunkIndex: Math.floor(i / LOT_SIZE) + 1,
      totalChunks: Math.ceil(pairs.length / LOT_SIZE),
      pairs: pairs.slice(i, i + LOT_SIZE)
    });
  }

  campaign.totalBatches = chunks.length;
  campaign.workersCount = NUM_PARALLEL_WORKERS;

  // Lancement asynchrone en arrière-plan
  (async () => {
    let nextChunkIdx = 0;
    let completed = 0;
    let failed = 0;
    let completedChunksCount = 0;

    const runWorker = async (workerId: number) => {
      while (nextChunkIdx < chunks.length) {
        const session = activePricingSessions.get(campaignId);
        if (!session || session.cancelled || abortController.signal.aborted) {
          break;
        }

        const currentChunk = chunks[nextChunkIdx++];
        if (!currentChunk) break;

        for (const pair of currentChunk.pairs) {
          const { origin, dest } = pair;
          if (session.cancelled || abortController.signal.aborted) break;

          const distKm = calculateDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng);
          const durationMin = Math.max(2, Math.round((distKm / 25) * 60));

          try {
            // Appels simultanés aux 3 agrégateurs réels
            const [yangoStats, heroStats, tmStats] = await Promise.all([
              callYangoRoutestats(origin.lat, origin.lng, dest.lat, dest.lng, 'econom', city.currency, abortController.signal),
              callHeroStats(origin.lat, origin.lng, dest.lat, dest.lng, 'econom', city.currency, origin.name, dest.name, abortController.signal),
              callTripMasterStats(origin.lat, origin.lng, dest.lat, dest.lng, city.currency, origin.name, dest.name, abortController.signal)
            ]);

            const yEco = yangoStats.priceEconom || (yangoStats.classes?.econom?.price) || yangoStats.price || null;
            const yConf = yangoStats.priceConfort || yangoStats.classes?.business?.price || yangoStats.classes?.comfort?.price || null;
            const yConfPlus = yangoStats.priceConfortPlus || yangoStats.classes?.comfortplus?.price || null;
            const yMoto = yangoStats.priceMoto || yangoStats.classes?.moto?.price || null;

            const hEco = heroStats.priceStandard || heroStats.price || null;
            const hConf = heroStats.priceConfort || null;
            const hSuv = heroStats.priceSuv || null;
            const hPerKm = heroStats.pricePerKm || null;

            const tmEco = tmStats.priceEco || null;
            const tmConf = tmStats.priceConfort || null;
            const tmMoto = tmStats.priceMoto || null;

            // Détermination du moins cher
            const ecoCandidates = [
              { name: 'yango', p: yEco },
              { name: 'hero', p: hEco },
              { name: 'tripmaster', p: tmEco }
            ].filter(c => c.p && c.p > 0);
            ecoCandidates.sort((a, b) => (a.p as number) - (b.p as number));

            const cheaperEco = ecoCandidates[0]?.name || null;
            const deltaEco = ecoCandidates.length > 1 ? (ecoCandidates[1].p as number) - (ecoCandidates[0].p as number) : 0;

            const confCandidates = [
              { name: 'yango', p: yConf },
              { name: 'hero', p: hConf },
              { name: 'tripmaster', p: tmConf }
            ].filter(c => c.p && c.p > 0);
            confCandidates.sort((a, b) => (a.p as number) - (b.p as number));
            const cheaperConf = confCandidates[0]?.name || null;

            const tripId = randomUUID();
            const cleanOrigin = cleanNeighborhoodName(origin.name);
            const cleanDest = cleanNeighborhoodName(dest.name);

            // 1. Structure JSON canonique ULTRA-LÉGÈRE demandée par l'utilisateur
            const canonicalTrip: CanonicalTrip = {
              id: tripId,
              origin: cleanOrigin,
              destination: cleanDest,
              distanceKm: distKm,
              durationMin: durationMin,
              prices: {
                yango: { eco: yEco, confort: yConf, confortPlus: yConfPlus, moto: yMoto },
                heroCab: { eco: hEco, confort: hConf, suv: hSuv, perKm: hPerKm },
                tripMaster: { eco: tmEco, confort: tmConf, moto: tmMoto }
              },
              cheapest: {
                eco: cheaperEco,
                confort: cheaperConf,
                overall: cheaperEco
              },
              status: (yEco || hEco || tmEco) ? 'success' : 'failed',
              createdAt: new Date().toISOString()
            };
            localCanonicalTrips.push(canonicalTrip);

            // 2. Objet aplati pour le tableau UI
            const tripRow: TripResult = {
              id: tripId,
              campaignId,
              cityId: city.id,
              cityName: city.name,
              startNeighborhoodId: origin.id,
              startNeighborhoodName: cleanOrigin,
              endNeighborhoodId: dest.id,
              endNeighborhoodName: cleanDest,
              distanceMeters: Math.round(distKm * 1000),
              distanceKm: distKm,
              durationSeconds: durationMin * 60,
              durationMinutes: durationMin,
              tariffClass: 'econom',
              price: yEco || hEco || tmEco || 0,
              priceFormatted: `${(yEco || hEco || tmEco || 0).toLocaleString('fr-FR')} ${city.currency}`,
              currency: city.currency,
              pricePerKm: distKm > 0 ? Math.round((yEco || hEco || tmEco || 0) / distKm) : 0,
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
              // Noms de colonnes directs
              yango_eco: yEco || undefined,
              yango_confort: yConf || undefined,
              yango_moto: yMoto || undefined,
              hero_eco: hEco || undefined,
              hero_confort: hConf || undefined,
              hero_suv: hSuv || undefined,
              tripmaster_eco: tmEco || undefined,
              tripmaster_confort: tmConf || undefined,
              tripmaster_moto: tmMoto || undefined,
              cheaperProvider: cheaperEco as any,
              deltaPriceYangoVsHero: deltaEco,
              source: 'yango_live',
              status: (yEco || hEco || tmEco) ? 'success' : 'failed',
              createdAt: new Date().toISOString()
            };
            localTrips.push(tripRow);

            if (yEco || hEco || tmEco) {
              completed++;
            } else {
              failed++;
            }
          } catch (e: any) {
            failed++;
          }

          campaign.completedPairs = completed;
          campaign.failedPairs = failed;
          campaign.durationSeconds = Math.max(1, Math.round((Date.now() - new Date(campaign.startedAt).getTime()) / 1000));
        }

        completedChunksCount++;
        campaign.completedBatches = completedChunksCount;
      }
    };

    // Exécution concurrente des workers
    const activeWorkers = Array.from({ length: NUM_PARALLEL_WORKERS }, (_, idx) => runWorker(idx + 1));
    await Promise.all(activeWorkers);

    const session = activePricingSessions.get(campaignId);
    if (session?.cancelled || campaign.status === 'cancelled') {
      campaign.status = 'cancelled';
      campaign.logs?.push({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: 'Campagne interrompue par l’utilisateur.'
      });
    } else if (completed === 0 && failed > 0) {
      campaign.status = 'failed';
      campaign.finishedAt = new Date().toISOString();
      campaign.errorMessage = campaign.lastError || 'Aucun trajet n’a pu être tarifé par les API.';
    } else {
      campaign.status = 'completed';
      campaign.finishedAt = new Date().toISOString();
      campaign.completedAt = campaign.finishedAt;
      campaign.durationSeconds = Math.round((new Date(campaign.finishedAt).getTime() - new Date(campaign.startedAt).getTime()) / 1000);

      // Statistiques globales basées sur les prix réels convertis
      let sumYangoEco = 0;
      let countYango = 0;
      let sumHeroEco = 0;
      let countHero = 0;
      let sumTmEco = 0;
      let countTm = 0;
      let sumDist = 0;

      let yangoCheaper = 0;
      let heroCheaper = 0;
      let equalCount = 0;
      let totalDelta = 0;

      for (const t of localCanonicalTrips) {
        sumDist += t.distanceKm;
        const y = t.prices.yango.eco;
        const h = t.prices.heroCab.eco;
        const tm = t.prices.tripMaster.eco;

        if (y && y > 0) { sumYangoEco += y; countYango++; }
        if (h && h > 0) { sumHeroEco += h; countHero++; }
        if (tm && tm > 0) { sumTmEco += tm; countTm++; }

        if (t.cheapest.eco === 'yango') yangoCheaper++;
        else if (t.cheapest.eco === 'hero') heroCheaper++;
        else equalCount++;

        if (y && h) {
          totalDelta += Math.abs(y - h);
        }
      }

      campaign.avgDistanceKm = completed > 0 ? Number((sumDist / completed).toFixed(2)) : 0;
      campaign.avgPrice = countYango > 0 ? Math.round(sumYangoEco / countYango) : 0;
      campaign.avgPricePerKm = campaign.avgDistanceKm > 0 ? Math.round(campaign.avgPrice / campaign.avgDistanceKm) : 0;

      campaign.heroStats = {
        avgPrice: countHero > 0 ? Math.round(sumHeroEco / countHero) : 0,
        minPrice: 0,
        maxPrice: 0,
        avgDriversCount: 0,
        avgClosestDriverDistanceKm: 0
      };

      campaign.tripMasterStats = {
        avgPrice: countTm > 0 ? Math.round(sumTmEco / countTm) : 0,
        minPrice: 0,
        maxPrice: 0
      };

      campaign.deltaStats = {
        yangoCheaperCount: yangoCheaper,
        heroCheaperCount: heroCheaper,
        equalCount,
        avgDeltaFcfa: completed > 0 ? Math.round(totalDelta / completed) : 0
      };

      campaign.canonicalTripsCount = localCanonicalTrips.length;
    }

    // Persistance Firestore optimisée :
    // 1. Enregistre les métadonnées de la campagne dans 'campaigns' (< 10 Ko)
    await safeFirestoreWrite('saveCampaignMeta', async () => {
      await setDoc(doc(db!, 'campaigns', campaignId), cleanFirestoreDoc(campaign));
    });

    // 2. Enregistre notre JSON canonique dans 'campaign_results' avec découpage en tranches < 400 Ko
    // Garanti strictement < 1 Mo par document Firestore !
    await saveCanonicalCampaignResults(campaignId, city.name, localCanonicalTrips);

    // Sauvegarde en mémoire locale pour accès immédiat
    memoryCampaignTrips[campaignId] = localTrips;
    memoryCampaignCanonicalTrips[campaignId] = localCanonicalTrips;
    const existingIdx = memoryCampaigns.findIndex(c => c.id === campaignId);
    if (existingIdx >= 0) {
      memoryCampaigns[existingIdx] = campaign;
    } else {
      memoryCampaigns.unshift(campaign);
    }

    // Libération instantanée de la session de calcul pour éviter toute consommation de RAM
    activePricingSessions.delete(campaignId);

    await recordHistory({
      action: 'complete_campaign',
      eventType: 'campaign',
      title: `Campagne ${isTestSample ? 'Test ' : ''}${city.name} terminée`,
      description: `${completed} trajets tarifés en ${campaign.durationSeconds}s. Format JSON canonique stocké en BD.`
    });
  })();
}
