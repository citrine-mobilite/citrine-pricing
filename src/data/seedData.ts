import { City, Neighborhood, PricingCampaign, TripResult, User, YangoSettings } from '../types';
import { getDoualaFullAddressNeighborhoods } from './officialDoualaNeighborhoods';

export const CAMEROON_SLOTS: string[] = [];

export const INITIAL_CITIES: City[] = [
  {
    id: 'city_douala',
    name: 'Douala',
    country: 'Cameroun',
    currency: 'XAF',
    currencySymbol: 'FCFA',
    active: true,
    center: { lat: 4.0511, lng: 9.7679 },
    autoSchedule: {
      enabled: false,
      slots: [],
      lastRunAt: undefined
    }
  },
  {
    id: 'city_yaounde',
    name: 'Yaoundé',
    country: 'Cameroun',
    currency: 'XAF',
    currencySymbol: 'FCFA',
    active: true,
    center: { lat: 3.8480, lng: 11.5021 },
    autoSchedule: {
      enabled: false,
      slots: [],
      lastRunAt: undefined
    }
  }
];

export const INITIAL_NEIGHBORHOODS: Neighborhood[] = [
  // Douala (Données officielles avec Adresse Complète - Douala 1er à 5e)
  ...getDoualaFullAddressNeighborhoods('city_douala'),

  // Yaoundé
  { id: 'nb_yde_bastos', cityId: 'city_yaounde', name: 'Bastos (Ambassades)', lat: 3.8911, lng: 11.5122, active: true, zoneType: 'residential' },
  { id: 'nb_yde_centre', cityId: 'city_yaounde', name: 'Centre-Ville (Poste Centrale)', lat: 3.8667, lng: 11.5167, active: true, zoneType: 'center' },
  { id: 'nb_yde_omnisports', cityId: 'city_yaounde', name: 'Omnisports (Mfandena)', lat: 3.8794, lng: 11.5369, active: true, zoneType: 'commercial' },
  { id: 'nb_yde_mvan', cityId: 'city_yaounde', name: 'Mvan (Gare Routière)', lat: 3.8211, lng: 11.5194, active: true, zoneType: 'commercial' },
  { id: 'nb_yde_biyemassi', cityId: 'city_yaounde', name: 'Biyem-Assi', lat: 3.8394, lng: 11.4889, active: true, zoneType: 'popular' },
  { id: 'nb_yde_tsinga', cityId: 'city_yaounde', name: 'Tsinga', lat: 3.8822, lng: 11.4989, active: true, zoneType: 'residential' },
  { id: 'nb_yde_odza', cityId: 'city_yaounde', name: 'Odza', lat: 3.7956, lng: 11.5372, active: true, zoneType: 'residential' },
  { id: 'nb_yde_nsimalen', cityId: 'city_yaounde', name: 'Aéroport International de Nsimalen', lat: 3.7225, lng: 11.5533, active: true, zoneType: 'airport' }
];

export const INITIAL_SETTINGS: YangoSettings = {
  apiEndpoint: 'https://ya-authproxy.yango.com/3.0/routestats',
  bearerToken: '',
  userAgent: 'CitrinePricing-Intelligence/2.0',
  requestDelayMs: 120,
  mode: 'live',
  classes: [
    { id: 'econom', name: 'Éco / Standard', label: 'Tarif standard Yango Cameroun' },
    { id: 'comfort', name: 'Confort / Berline', label: 'Véhicules climatisés récents' }
  ]
};

export const INITIAL_USERS: User[] = [
  {
    id: 'usr_admin_01',
    email: 'admin@citrine-pricing.cm',
    name: 'Admin',
    role: 'admin',
    active: true,
    createdAt: '2026-01-10T08:00:00.000Z',
    lastLoginAt: '2026-09-23T08:30:00.000Z'
  }
];

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export function estimateUrbanTrip(
  distKm: number,
  tariffClass: string = 'econom',
  hour: number = 12
) {
  const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
  const surge = isPeak ? 1.25 : 1.0;

  const baseFare = tariffClass === 'comfort' ? 1200 : 800;
  const kmRate = tariffClass === 'comfort' ? 240 : 190;
  const minRate = tariffClass === 'comfort' ? 45 : 30;

  const avgSpeedKmh = isPeak ? 18 : 28;
  const durationMin = Math.max(5, Math.round((distKm / avgSpeedKmh) * 60));

  const rawPrice = (baseFare + distKm * kmRate + durationMin * minRate) * surge;
  const finalPrice = Math.round(rawPrice / 50) * 50;

  return {
    price: finalPrice,
    distanceKm: distKm,
    durationMinutes: durationMin,
    surge,
    waitingTimeMinutes: Math.max(2, Math.round(Math.random() * 4 + 2))
  };
}

export function generateInitialCampaigns(): {
  campaigns: PricingCampaign[];
  tripResults: TripResult[];
} {
  const campaigns: PricingCampaign[] = [];
  const tripResults: TripResult[] = [];

  const doualaCity = INITIAL_CITIES[0];
  const doualaNeighborhoods = INITIAL_NEIGHBORHOODS.filter(n => n.cityId === doualaCity.id && n.active);

  const samplePairs: Array<{ origin: Neighborhood; dest: Neighborhood }> = [];
  for (let i = 0; i < Math.min(10, doualaNeighborhoods.length); i++) {
    for (let j = 0; j < Math.min(10, doualaNeighborhoods.length); j++) {
      if (i !== j && samplePairs.length < 72) {
        samplePairs.push({
          origin: doualaNeighborhoods[i],
          dest: doualaNeighborhoods[j]
        });
      }
    }
  }

  const campId = 'camp_dla_01';
  const campDate = '2026-09-23T09:00:00.000Z';
  let sumPrice = 0;
  let sumDist = 0;
  let minP = Infinity;
  let maxP = -Infinity;

  samplePairs.forEach((pair, idx) => {
    const dist = calculateDistanceKm(pair.origin.lat, pair.origin.lng, pair.dest.lat, pair.dest.lng);
    const simEco = estimateUrbanTrip(dist, 'econom', 9);
    const simConf = estimateUrbanTrip(dist, 'comfort', 9);

    const priceEco = simEco.price;
    const priceConf = simConf.price;
    const priceConfPlus = Math.round((priceEco * 1.25 + 200) / 50) * 50;
    const priceMoto = Math.max(300, Math.round((priceEco * 0.35) / 50) * 50);

    const priceHeroStd = Math.max(800, Math.round((1000 + dist * 220 + simEco.durationMinutes * 50) / 50) * 50);
    const priceHeroConf = Math.max(1000, Math.round((1300 + dist * 260 + simConf.durationMinutes * 60) / 50) * 50);

    sumPrice += priceEco;
    sumDist += dist;
    if (priceEco < minP) minP = priceEco;
    if (priceEco > maxP) maxP = priceEco;

    const delta = priceEco - priceHeroStd;
    const cheaper: 'hero' | 'yango' | 'equal' = delta > 0 ? 'hero' : (delta < 0 ? 'yango' : 'equal');

    tripResults.push({
      id: `trip_init_${idx + 1}`,
      campaignId: campId,
      cityId: doualaCity.id,
      cityName: doualaCity.name,
      startNeighborhoodId: pair.origin.id,
      startNeighborhoodName: pair.origin.name,
      startCoordinates: [pair.origin.lat, pair.origin.lng],
      endNeighborhoodId: pair.dest.id,
      endNeighborhoodName: pair.dest.name,
      endCoordinates: [pair.dest.lat, pair.dest.lng],
      distanceMeters: Math.round(dist * 1000),
      distanceKm: dist,
      durationSeconds: simEco.durationMinutes * 60,
      durationMinutes: simEco.durationMinutes,
      tariffClass: 'econom',
      price: priceEco,
      priceFormatted: `${priceEco.toLocaleString('fr-FR')} FCFA`,
      currency: 'XAF',
      pricePerKm: dist > 0 ? Math.round(priceEco / dist) : 0,
      waitingTimeMinutes: simEco.waitingTimeMinutes,

      classes: {
        econom: {
          tariffClass: 'econom',
          className: 'Éco',
          price: priceEco,
          priceFormatted: `${priceEco.toLocaleString('fr-FR')} FCFA`,
          pricePerKm: dist > 0 ? Math.round(priceEco / dist) : 0,
          waitingTimeMinutes: simEco.waitingTimeMinutes
        },
        business: {
          tariffClass: 'business',
          className: 'Confort',
          price: priceConf,
          priceFormatted: `${priceConf.toLocaleString('fr-FR')} FCFA`,
          pricePerKm: dist > 0 ? Math.round(priceConf / dist) : 0,
          waitingTimeMinutes: simConf.waitingTimeMinutes
        },
        comfortplus: {
          tariffClass: 'comfortplus',
          className: 'Confort+',
          price: priceConfPlus,
          priceFormatted: `${priceConfPlus.toLocaleString('fr-FR')} FCFA`,
          pricePerKm: dist > 0 ? Math.round(priceConfPlus / dist) : 0,
          waitingTimeMinutes: 3
        },
        moto: {
          tariffClass: 'moto',
          className: 'Moto',
          price: priceMoto,
          priceFormatted: `${priceMoto.toLocaleString('fr-FR')} FCFA`,
          pricePerKm: dist > 0 ? Math.round(priceMoto / dist) : 0,
          waitingTimeMinutes: 2
        }
      },
      availableClasses: ['econom', 'business', 'comfortplus', 'moto'],
      priceEconom: priceEco,
      priceConfort: priceConf,
      priceConfortPlus: priceConfPlus,
      priceMoto: priceMoto,

      heroQuote: {
        success: true,
        source: 'hero_live',
        price: priceHeroStd,
        priceFormatted: `${priceHeroStd.toLocaleString('fr-FR')} FCFA`,
        pricePerKm: dist > 0 ? Math.round(priceHeroStd / dist) : 0,
        priceStandard: priceHeroStd,
        priceConfort: priceHeroConf,
        availableDriversCount: 5,
        closestDriverDistanceKm: 1.8,
        closestDriverName: 'Jean Paul (Hero)',
        waitingTimeMinutes: 3
      },
      priceHero: priceHeroStd,
      priceHeroStandard: priceHeroStd,
      priceHeroConfort: priceHeroConf,
      heroDriversCount: 5,
      heroClosestDriverDistanceKm: 1.8,
      deltaPriceYangoVsHero: delta,
      cheaperProvider: cheaper,

      source: 'yango_live',
      status: 'success',
      createdAt: campDate
    });
  });

  const completedCount = samplePairs.length;
  campaigns.push({
    id: campId,
    cityId: doualaCity.id,
    cityName: doualaCity.name,
    currency: 'XAF',
    triggerType: 'scheduled',
    triggeredByUserId: 'system',
    triggeredByUserName: 'Automate 09:00',
    status: 'completed',
    selectedClasses: ['econom', 'comfort'],
    totalPairs: completedCount,
    completedPairs: completedCount,
    failedPairs: 0,
    startedAt: campDate,
    finishedAt: '2026-09-23T09:00:22.000Z',
    durationSeconds: 22,
    avgPrice: completedCount > 0 ? Math.round(sumPrice / completedCount) : 0,
    minPrice: minP === Infinity ? 0 : minP,
    maxPrice: maxP === -Infinity ? 0 : maxP,
    avgDistanceKm: completedCount > 0 ? Number((sumDist / completedCount).toFixed(2)) : 0,
    avgPricePerKm: completedCount > 0 && sumDist > 0 ? Math.round(sumPrice / sumDist) : 0,
    errorCount: 0
  });

  return { campaigns, tripResults };
}
