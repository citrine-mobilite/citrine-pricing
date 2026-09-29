import { SystemSettings } from '../types.js';
import { calculateDistanceKm } from './yangoService.js';

export let heroSettings: SystemSettings = {
  id: 'hero',
  apiEndpoint: 'https://demos.bbcsproducts.net/herocabpro/booking/cx-ajax_booking_details.php',
  mode: 'real',
  requestDelayMs: 250,
  updatedAt: new Date().toISOString()
};

export function updateHeroSettings(newSettings: Partial<SystemSettings>) {
  heroSettings = { ...heroSettings, ...newSettings, updatedAt: new Date().toISOString() };
}

export function parseHeroPriceNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  if (!val) return 0;
  const str = String(val).replace(/CFA|FCFA|XAF/gi, '').replace(/\s+/g, '').replace(/,/g, '.');
  const clean = str.replace(/[^\d.]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num);
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
  const distMeters = Math.max(500, Math.round(distKm * 1000));
  const durationSeconds = Math.max(120, Math.round((distKm / 25) * 3600));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const payload = new URLSearchParams({
      type: 'getVehicles',
      eType: 'Ride',
      from_lat: String(startLat),
      from_long: String(startLng),
      to_lat: String(endLat),
      to_long: String(endLng),
      distance: String(distMeters),
      duration: String(durationSeconds),
      promoCode: '',
      iFromStationId: '0',
      iToStationId: '0',
      userType: 'Rider',
      iUserId: '31',
      booking_date: ''
    });

    const res = await fetch(heroSettings.apiEndpoint || 'https://demos.bbcsproducts.net/herocabpro/booking/cx-ajax_booking_details.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: payload,
      signal: signal || controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
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
        errorMessage: `HTTP ${res.status}: ${res.statusText}`
      };
    }

    const html = await res.text();

    let extractedStandardPrice = 0;
    let extractedConfortPrice = 0;
    let extractedSuvPrice = 0;

    const inputRegex = /<input[^>]+name=['"]iVehicleTypeId['"][^>]*>/gi;
    const matches = html.match(inputRegex) || [];

    for (const tag of matches) {
      const vIdMatch = tag.match(/value\s*=\s*['"](\d+)['"]/i);
      const fareMatch = tag.match(/data-fare-with-currency-symbol\s*=\s*['"]([^'"]+)['"]/i) ||
                        tag.match(/data-amount\s*=\s*['"]([^'"]+)['"]/i);

      if (vIdMatch && fareMatch) {
        const vId = vIdMatch[1];
        const fare = parseHeroPriceNumber(fareMatch[1]);
        if (vId === '1') extractedStandardPrice = fare;
        else if (vId === '3') extractedConfortPrice = fare;
        else if (vId === '654') extractedSuvPrice = fare;
      }
    }

    const isSuccess = Boolean(extractedStandardPrice || extractedConfortPrice || extractedSuvPrice);
    const chosenPrice = (tariffClass === 'comfort' || tariffClass === 'business')
      ? (extractedConfortPrice || extractedStandardPrice || 0)
      : (extractedStandardPrice || 0);

    return {
      success: isSuccess,
      source: 'hero_live',
      price: chosenPrice,
      priceFormatted: chosenPrice > 0 ? `${chosenPrice.toLocaleString('fr-FR')} ${cityCurrency}` : 'Non disponible',
      pricePerKm: distKm > 0 && chosenPrice > 0 ? Math.round(chosenPrice / distKm) : 0,
      priceStandard: extractedStandardPrice || undefined,
      priceConfort: extractedConfortPrice || undefined,
      priceSuv: extractedSuvPrice || undefined,
      availableDriversCount: isSuccess ? 1 : 0,
      waitingTimeMinutes: isSuccess ? 3 : 0,
      latencyMs: Date.now() - startTime,
      httpStatus: 200,
      errorMessage: isSuccess ? undefined : 'Aucun tarif disponible via Hero Cab',
      rawText: html,
      rawResponse: html
    };
  } catch (err: any) {
    return {
      success: false,
      source: 'hero_live',
      price: 0,
      priceFormatted: 'Non disponible',
      pricePerKm: 0,
      availableDriversCount: 0,
      waitingTimeMinutes: 0,
      latencyMs: Date.now() - startTime,
      httpStatus: 500,
      errorMessage: err.message
    };
  }
}
