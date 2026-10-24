import { SystemSettings } from '../types.js';
import { calculateDistanceKm } from './yangoService.js';
import { pooledPostUrlEncoded } from '../utils/httpPool.js';

export let heroSettings: SystemSettings = {
  id: 'hero',
  apiEndpoint: 'https://demos.bbcsproducts.net/herocabpro/booking/cx-ajax_booking_details.php',
  mode: 'real', // 100% requêtes HTTP réelles en direct
  requestDelayMs: 0,
  enabled: true,
  updatedAt: new Date().toISOString()
};

export function updateHeroSettings(newSettings: Partial<SystemSettings>) {
  heroSettings = { ...heroSettings, ...newSettings, updatedAt: new Date().toISOString() };
}

export function parseHeroPriceNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  if (!val) return 0;
  let str = String(val).trim();
  // Supprime devises et espaces
  str = str.replace(/CFA|FCFA|XAF|\$/gi, '').replace(/\s+/g, '');

  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/,/g, '');
  } else if (/^\d{1,3}(,\d{3})+$/.test(str)) {
    str = str.replace(/,/g, '');
  } else if (/^\d+,\d{1,2}$/.test(str)) {
    str = str.replace(',', '.');
  } else {
    str = str.replace(/,/g, '');
  }

  const clean = str.replace(/[^\d.]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Calcul mathématique optionnel (uniquement si explicitement configuré en mode 'formula')
 */
export function computeHeroMathematicalPrices(
  distKm: number,
  durationMinutes?: number
): { standard: number; confort: number; suv: number } {
  const km = Math.max(0.1, distKm);
  const durSec = Math.max(120, Math.round((km / 25) * 3600));
  const durMin = (durationMinutes !== undefined && durationMinutes > 0)
    ? durationMinutes
    : (durSec / 60);

  const standard = Math.max(510, Math.round(250 + 150 * km + 10 * durMin));
  const confort = Math.max(910, Math.round(350 + 180 * km + 12 * durMin));
  const suv = Math.max(1200, Math.round(500 + 220 * km + 15 * durMin));

  return { standard, confort, suv };
}

export async function callHeroStats(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  tariffClass: string = 'standard',
  cityCurrency: string = 'XAF',
  originName: string = 'Départ',
  destName: string = 'Destination',
  signal?: AbortSignal
): Promise<{
  success: boolean;
  source: string;
  price: number;
  priceFormatted: string;
  pricePerKm: number;
  priceStandard?: number;
  priceConfort?: number;
  priceSuv?: number;
  availableDriversCount: number;
  waitingTimeMinutes: number;
  latencyMs: number;
  httpStatus?: number;
  errorMessage?: string;
  rawText?: string;
  rawResponse?: any;
}> {
  const startTime = Date.now();
  const distKm = calculateDistanceKm(startLat, startLng, endLat, endLng);
  const durSec = Math.max(120, Math.round((distKm / 25) * 3600));
  const durMin = durSec / 60;

  if (heroSettings.enabled === false) {
    return {
      success: false,
      source: 'hero_disabled',
      price: 0,
      priceFormatted: '0 ' + cityCurrency,
      pricePerKm: 0,
      availableDriversCount: 0,
      waitingTimeMinutes: 0,
      latencyMs: 0,
      errorMessage: 'Agrégateur Hero Cab désactivé'
    };
  }

  // Si mode formule explicitement forcé dans les paramètres
  if (heroSettings.mode === 'formula') {
    const math = computeHeroMathematicalPrices(distKm, durMin);
    const chosenPrice = (tariffClass === 'comfort' || tariffClass === 'confort' || tariffClass === 'business')
      ? math.confort
      : math.standard;

    return {
      success: true,
      source: 'hero_formula_calibrated',
      price: chosenPrice,
      priceFormatted: `${chosenPrice.toLocaleString('fr-FR')} ${cityCurrency}`,
      pricePerKm: distKm > 0 ? Math.round(chosenPrice / distKm) : 0,
      priceStandard: math.standard,
      priceConfort: math.confort,
      priceSuv: math.suv,
      availableDriversCount: 1,
      waitingTimeMinutes: 3,
      latencyMs: Date.now() - startTime,
      httpStatus: 200,
      rawResponse: { mode: 'formula_calibrated', ...math }
    };
  }

  // Mode LIVE REQUÊTE RÉELLE (avec pool de connexions persistantes Keep-Alive)
  try {
    const distMeters = Math.max(500, Math.round(distKm * 1000));
    const payload = {
      type: 'getVehicles',
      eType: 'Ride',
      from_lat: String(startLat),
      from_long: String(startLng),
      to_lat: String(endLat),
      to_long: String(endLng),
      distance: String(distMeters),
      duration: String(durSec),
      promoCode: '',
      iFromStationId: '0',
      iToStationId: '0',
      userType: 'Rider',
      iUserId: '31',
      booking_date: ''
    };

    const endpoint = heroSettings.apiEndpoint || 'https://demos.bbcsproducts.net/herocabpro/booking/cx-ajax_booking_details.php';
    const res = await pooledPostUrlEncoded(
      endpoint,
      payload,
      {
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://demos.bbcsproducts.net/herocabpro/booking/'
      },
      10000 // Timeout 10 000 ms
    );

    const html = res.body;
    let extractedStandardPrice = 0;
    let extractedConfortPrice = 0;
    let extractedSuvPrice = 0;

    const inputRegex = /<input[^>]+name=['"]iVehicleTypeId['"][^>]*>/gi;
    const matches = html.match(inputRegex) || [];

    for (const tag of matches) {
      const vIdMatch = tag.match(/value\s*=\s*['"](\d+)['"]/i);
      const fareMatch = tag.match(/data-fare-with-currency-symbol\s*=\s*['"]([^'"]+)['"]/i) ||
                        tag.match(/data-amount-with-currency-symbol\s*=\s*['"]([^'"]+)['"]/i) ||
                        tag.match(/data-amount\s*=\s*['"]([^'"]+)['"]/i);

      if (vIdMatch && fareMatch) {
        const vId = vIdMatch[1];
        const fare = parseHeroPriceNumber(fareMatch[1]);
        if (fare > 0) {
          if (vId === '1') extractedStandardPrice = fare;
          else if (vId === '3') extractedConfortPrice = fare;
          else if (vId === '654') extractedSuvPrice = fare;
          else if (extractedStandardPrice === 0) extractedStandardPrice = fare;
        }
      }
    }

    if (extractedStandardPrice > 0 || extractedConfortPrice > 0 || extractedSuvPrice > 0) {
      if (extractedStandardPrice === 0) extractedStandardPrice = extractedConfortPrice || extractedSuvPrice;
      if (extractedConfortPrice === 0) extractedConfortPrice = extractedStandardPrice;
      const chosenPrice = (tariffClass === 'comfort' || tariffClass === 'confort' || tariffClass === 'business')
        ? (extractedConfortPrice || extractedStandardPrice)
        : (extractedStandardPrice || extractedConfortPrice);

      return {
        success: true,
        source: 'hero_live',
        price: chosenPrice,
        priceFormatted: `${chosenPrice.toLocaleString('fr-FR')} ${cityCurrency}`,
        pricePerKm: distKm > 0 ? Math.round(chosenPrice / distKm) : 0,
        priceStandard: extractedStandardPrice || undefined,
        priceConfort: extractedConfortPrice || undefined,
        priceSuv: extractedSuvPrice || undefined,
        availableDriversCount: 1,
        waitingTimeMinutes: 3,
        latencyMs: Date.now() - startTime,
        httpStatus: res.status,
        rawText: html,
        rawResponse: html
      };
    }

    // Si aucune voiture disponible dans la réponse HTML
    return {
      success: false,
      source: 'hero_live',
      price: 0,
      priceFormatted: 'Non disponible',
      pricePerKm: 0,
      availableDriversCount: 0,
      waitingTimeMinutes: 0,
      latencyMs: Date.now() - startTime,
      httpStatus: res.status,
      errorMessage: 'Aucun véhicule Hero Cab disponible sur ce trajet',
      rawText: html
    };
  } catch (err: any) {
    return {
      success: false,
      source: 'hero_live_error',
      price: 0,
      priceFormatted: 'Erreur réseau',
      pricePerKm: 0,
      availableDriversCount: 0,
      waitingTimeMinutes: 0,
      latencyMs: Date.now() - startTime,
      errorMessage: `Hero Cab live error: ${err.message}`
    };
  }
}
