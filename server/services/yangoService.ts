import { SystemSettings } from '../types.js';

export let yangoSettings: SystemSettings = {
  id: 'yango',
  apiEndpoint: 'https://ya-authproxy.yango.com/3.0/routestats',
  bearerToken: '',
  mode: 'real',
  requestDelayMs: 250,
  updatedAt: new Date().toISOString()
};

export let lastYangoRawJson: any = null;
export let lastYangoRawText: string = '';
export let lastYangoRawTimestamp: string = '';

export function getLastYangoRaw() {
  return {
    timestamp: lastYangoRawTimestamp,
    rawJson: lastYangoRawJson,
    rawText: lastYangoRawText
  };
}

export function updateYangoSettings(newSettings: Partial<SystemSettings>) {
  yangoSettings = { ...yangoSettings, ...newSettings, updatedAt: new Date().toISOString() };
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

function extractPriceNumber(sl: any): number {
  if (!sl) return 0;
  if (typeof sl.max_price_as_decimal === 'number' && sl.max_price_as_decimal > 0) {
    return Math.round(sl.max_price_as_decimal);
  }
  if (typeof sl.max_price_as_decimal === 'string' && sl.max_price_as_decimal.trim()) {
    const val = parseFloat(sl.max_price_as_decimal.replace(/[^\d.]/g, ''));
    if (!isNaN(val) && val > 0) return Math.round(val);
  }
  if (sl.description_parts?.value) {
    const val = parseFloat(String(sl.description_parts.value).replace(/[^\d.]/g, ''));
    if (!isNaN(val) && val > 0) return Math.round(val);
  }
  if (typeof sl.price === 'number' && sl.price > 0) {
    return Math.round(sl.price);
  }
  if (typeof sl.price === 'string' && sl.price.trim()) {
    const val = parseFloat(sl.price.replace(/[^\d.]/g, ''));
    if (!isNaN(val) && val > 0) return Math.round(val);
  }
  if (typeof sl.cost === 'number' && sl.cost > 0) {
    return Math.round(sl.cost);
  }
  if (typeof sl.cost === 'string' && sl.cost.trim()) {
    const val = parseFloat(sl.cost.replace(/[^\d.]/g, ''));
    if (!isNaN(val) && val > 0) return Math.round(val);
  }
  return 0;
}

export async function callYangoRoutestats(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  tariffClass: string = 'econom',
  cityCurrency: string = 'XAF',
  signal?: AbortSignal
): Promise<{
  success: boolean;
  source: string;
  price: number;
  priceFormatted: string;
  distanceKm: number;
  durationMinutes: number;
  classes?: Record<string, { price: number; name: string }>;
  availableClasses?: string[];
  priceEconom?: number;
  priceConfort?: number;
  priceConfortPlus?: number;
  priceMoto?: number;
  waitingTimeMinutes?: number;
  latencyMs: number;
  httpStatus?: number;
  errorMessage?: string;
  rawJson?: any;
  rawText?: string;
}> {
  const startTime = Date.now();
  const distKm = calculateDistanceKm(startLat, startLng, endLat, endLng);
  const durationMin = Math.max(2, Math.round((distKm / 25) * 60));

  const payload = {
    route: [
      [startLng, startLat],
      [endLng, endLat]
    ],
    selected_class: tariffClass,
    format_currency: true
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
    };

    if (yangoSettings.bearerToken) {
      headers['Authorization'] = `Bearer ${yangoSettings.bearerToken}`;
    }

    const res = await fetch(yangoSettings.apiEndpoint || 'https://ya-authproxy.yango.com/3.0/routestats', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: signal || controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errJson = null;
      try { errJson = JSON.parse(errText); } catch {}
      return {
        success: false,
        source: 'yango_live',
        price: 0,
        priceFormatted: 'Non disponible',
        distanceKm: distKm,
        durationMinutes: durationMin,
        latencyMs: Date.now() - startTime,
        httpStatus: res.status,
        errorMessage: `HTTP ${res.status}: ${res.statusText}`,
        rawJson: errJson,
        rawText: errText
      };
    }

    const json: any = await res.json();
    lastYangoRawJson = json;
    lastYangoRawText = JSON.stringify(json);
    lastYangoRawTimestamp = new Date().toISOString();

    const serviceLevels: any[] = json.service_levels || json.tariffs || json.options || json.offers || [];

    const classes: Record<string, { price: number; name: string }> = {};
    let priceEconom = 0;
    let priceConfort = 0;
    let priceConfortPlus = 0;
    let priceMoto = 0;

    serviceLevels.forEach((sl: any) => {
      const clsName = (sl.class || sl.tariff_class || sl.name || '').toLowerCase();
      const p = extractPriceNumber(sl);
      if (p > 0) {
        classes[clsName] = { price: p, name: sl.name || sl.class_name || clsName };
        if (clsName === 'econom' || clsName === 'standard' || clsName === 'eco' || clsName === 'éco') {
          priceEconom = p;
        } else if (clsName === 'business' || clsName === 'comfort' || clsName === 'confort') {
          priceConfort = p;
        } else if (clsName === 'comfortplus' || clsName === 'confort+' || clsName === 'comfort_plus') {
          priceConfortPlus = p;
        } else if (clsName === 'moto' || clsName === 'bike') {
          priceMoto = p;
        }
      }
    });

    const realDist = json.distance ? (parseFloat(String(json.distance).replace(/[^\d.]/g, '')) || distKm) : distKm;
    const realDurationMin = json.time_seconds ? Math.round(json.time_seconds / 60) : durationMin;

    const chosenPrice = priceEconom || priceConfort || priceMoto || 0;

    return {
      success: chosenPrice > 0,
      source: 'yango_live',
      price: chosenPrice,
      priceFormatted: chosenPrice > 0 ? `${chosenPrice.toLocaleString('fr-FR')} ${cityCurrency}` : 'Non disponible',
      distanceKm: realDist,
      durationMinutes: realDurationMin,
      classes,
      availableClasses: Object.keys(classes),
      priceEconom: priceEconom || undefined,
      priceConfort: priceConfort || undefined,
      priceConfortPlus: priceConfortPlus || undefined,
      priceMoto: priceMoto || undefined,
      waitingTimeMinutes: 3,
      latencyMs: Date.now() - startTime,
      httpStatus: 200,
      rawJson: json
    };
  } catch (err: any) {
    return {
      success: false,
      source: 'yango_live',
      price: 0,
      priceFormatted: 'Non disponible',
      distanceKm: distKm,
      durationMinutes: durationMin,
      latencyMs: Date.now() - startTime,
      httpStatus: 500,
      errorMessage: err.message
    };
  }
}
