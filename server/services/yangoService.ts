import { SystemSettings } from '../types.js';

export let yangoSettings: SystemSettings = {
  id: 'yango',
  apiEndpoint: 'https://ya-authproxy.yango.com/3.0/routestats',
  bearerToken: '',
  mode: 'real',
  requestDelayMs: 250,
  enabled: true,
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

export function extractYangoDistance(json: any, fallbackDistKm: number): { distanceKm: number; distanceMeters: number; isRoadDistance: boolean } {
  if (!json) {
    return {
      distanceKm: fallbackDistKm,
      distanceMeters: Math.round(fallbackDistKm * 1000),
      isRoadDistance: false
    };
  }

  let distRaw = json.distance ?? json.distance_meters ?? json.route_length ?? json.route_distance ?? null;

  // Search inside service_levels if not found at root
  if (distRaw === null && Array.isArray(json.service_levels)) {
    for (const sl of json.service_levels) {
      if (sl.distance !== undefined && sl.distance !== null) {
        distRaw = sl.distance;
        break;
      }
      if (sl.route_distance !== undefined && sl.route_distance !== null) {
        distRaw = sl.route_distance;
        break;
      }
    }
  }

  if (distRaw === null || distRaw === undefined) {
    return {
      distanceKm: fallbackDistKm,
      distanceMeters: Math.round(fallbackDistKm * 1000),
      isRoadDistance: false
    };
  }

  // Case 1: String formatted (e.g. "2,5 км", "2.5 km", "850 м", "850 m", "14,2")
  if (typeof distRaw === 'string') {
    const s = distRaw.trim().toLowerCase();
    const isKm = s.includes('км') || s.includes('km');
    const isMeters = (s.includes('м') || s.endsWith('m') || s.includes('meter')) && !isKm;

    // Convert comma to dot decimal: "2,5" -> "2.5"
    const cleaned = s.replace(',', '.').replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);

    if (!isNaN(num) && num > 0) {
      if (isKm) {
        // e.g. "2,5 км" -> 2.5 km
        return {
          distanceKm: Number(num.toFixed(2)),
          distanceMeters: Math.round(num * 1000),
          isRoadDistance: true
        };
      }
      if (isMeters) {
        // e.g. "850 м" -> 0.85 km
        return {
          distanceKm: Number((num / 1000).toFixed(2)),
          distanceMeters: Math.round(num),
          isRoadDistance: true
        };
      }
      // If no unit is explicit:
      // If > 50, it is in meters (e.g. "2500" -> 2.5 km)
      if (num > 50) {
        return {
          distanceKm: Number((num / 1000).toFixed(2)),
          distanceMeters: Math.round(num),
          isRoadDistance: true
        };
      }
      // If <= 50, it is in km (e.g. "2.5" -> 2.5 km)
      return {
        distanceKm: Number(num.toFixed(2)),
        distanceMeters: Math.round(num * 1000),
        isRoadDistance: true
      };
    }
  }

  // Case 2: Number
  if (typeof distRaw === 'number' && distRaw > 0) {
    if (distRaw > 50) {
      // In meters
      return {
        distanceKm: Number((distRaw / 1000).toFixed(2)),
        distanceMeters: Math.round(distRaw),
        isRoadDistance: true
      };
    }
    // In kilometers
    return {
      distanceKm: Number(distRaw.toFixed(2)),
      distanceMeters: Math.round(distRaw * 1000),
      isRoadDistance: true
    };
  }

  return {
    distanceKm: fallbackDistKm,
    distanceMeters: Math.round(fallbackDistKm * 1000),
    isRoadDistance: false
  };
}

export function extractYangoDuration(json: any, fallbackDurationMin: number): number {
  if (!json) return fallbackDurationMin;

  // 1. time_seconds (e.g. 442 seconds -> Math.round(442/60) = 7 min or Math.ceil(442/60) = 8 min)
  if (typeof json.time_seconds === 'number' && json.time_seconds > 0) {
    return Math.max(1, Math.round(json.time_seconds / 60));
  }

  // 2. time as string (e.g. "8 мин", "8 min", "12 min")
  if (typeof json.time === 'string' && json.time.trim()) {
    const num = parseInt(json.time.replace(/[^\d]/g, ''), 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // 3. time as number (seconds)
  if (typeof json.time === 'number' && json.time > 0) {
    return Math.max(1, Math.round(json.time / 60));
  }

  if (typeof json.travel_time_seconds === 'number' && json.travel_time_seconds > 0) {
    return Math.max(1, Math.round(json.travel_time_seconds / 60));
  }

  if (typeof json.duration_seconds === 'number' && json.duration_seconds > 0) {
    return Math.max(1, Math.round(json.duration_seconds / 60));
  }

  if (typeof json.time_text === 'string' && json.time_text.trim()) {
    const parsed = parseInt(json.time_text.replace(/[^\d]/g, ''), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // Check in service_levels
  if (Array.isArray(json.service_levels)) {
    for (const sl of json.service_levels) {
      if (typeof sl.time_seconds === 'number' && sl.time_seconds > 0) {
        return Math.max(1, Math.round(sl.time_seconds / 60));
      }
      if (typeof sl.time === 'number' && sl.time > 0) {
        return Math.max(1, Math.round(sl.time / 60));
      }
    }
  }

  return fallbackDurationMin;
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
  if (Array.isArray(sl.details) && sl.details.length > 0) {
    for (const d of sl.details) {
      if (d && d.price) {
        const val = parseFloat(String(d.price).replace(/[^\d.]/g, ''));
        if (!isNaN(val) && val > 0) return Math.round(val);
      }
    }
  }
  if (Array.isArray(sl.details_tariff) && sl.details_tariff.length > 0) {
    for (const dt of sl.details_tariff) {
      if (dt && dt.type === 'price' && dt.value) {
        const val = parseFloat(String(dt.value).replace(/[^\d.]/g, ''));
        if (!isNaN(val) && val > 0) return Math.round(val);
      }
    }
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
  distanceMeters?: number;
  durationMinutes: number;
  classes?: Record<string, { price: number; name: string }>;
  availableClasses?: string[];
  priceEconom?: number;
  priceConfort?: number;
  priceConfortPlus?: number;
  priceMoto?: number;
  waitingTimeMinutes?: number;
  jams?: boolean;
  yangoUnavailable?: boolean;
  yangoWaitingMinutes?: number;
  yangoUnavailableClasses?: string[];
  availableCars?: string[];
  latencyMs: number;
  httpStatus?: number;
  errorMessage?: string;
  rawJson?: any;
  rawText?: string;
}> {
  const startTime = Date.now();
  const distKm = calculateDistanceKm(startLat, startLng, endLat, endLng);
  const durationMin = Math.max(2, Math.round((distKm / 25) * 60));

  if (yangoSettings.enabled === false) {
    return {
      success: false,
      source: 'yango_disabled',
      price: 0,
      priceFormatted: '0 ' + cityCurrency,
      distanceKm: distKm,
      durationMinutes: durationMin,
      latencyMs: 0,
      errorMessage: 'Agrégateur Yango désactivé'
    };
  }

  const payload = {
    route: [
      [startLng, startLat],
      [endLng, endLat]
    ],
    selected_class: tariffClass || 'econom',
    summary_version: 2,
    supported_markup: 'tml-0.1',
    supports_paid_options: true,
    extended_description: true,
    format_currency: true,
    is_lightweight: false,
    requirements: { coupon: '' },
    tariff_requirements: [
      { class: 'econom', requirements: { coupon: '' } },
      { class: 'business', requirements: { coupon: '' } },
      { class: 'comfortplus', requirements: { coupon: '' } },
      { class: 'moto', requirements: { coupon: '' } },
      { class: 'express', requirements: { coupon: '' } },
      { class: 'courier', requirements: { coupon: '' } }
    ],
    use_toll_roads: false
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
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

    const classes: Record<string, { price: number; name: string; unavailable?: boolean; waitingMinutes?: number }> = {};
    const unavailableClasses: string[] = [];
    const availableCarsList: string[] = [];
    let priceEconom = 0;
    let priceConfort = 0;
    let priceConfortPlus = 0;
    let priceMoto = 0;
    let primaryClassUnavailable = false;
    let estimatedWaitingMinutes: number | undefined = undefined;

    serviceLevels.forEach((sl: any) => {
      const clsName = (sl.class || sl.tariff_class || sl.name || '').toLowerCase();
      const isUnavailable = Boolean(sl.tariff_unavailable || sl.tariff_unavailable?.code === 'no_free_cars_nearby');

      if (isUnavailable) {
        unavailableClasses.push(clsName);
        if (clsName === 'econom' || clsName === 'standard' || clsName === 'eco' || clsName === 'éco') {
          primaryClassUnavailable = true;
        }
      }

      if (sl.cars && Array.isArray(sl.cars)) {
        sl.cars.forEach((c: string) => {
          if (c && !availableCarsList.includes(c)) availableCarsList.push(c);
        });
      }

      if (sl.estimated_waiting?.seconds && !estimatedWaitingMinutes) {
        estimatedWaitingMinutes = Math.max(1, Math.round(sl.estimated_waiting.seconds / 60));
      }

      const p = extractPriceNumber(sl);
      if (p > 0) {
        classes[clsName] = {
          price: p,
          name: sl.name || sl.class_name || clsName,
          unavailable: isUnavailable,
          waitingMinutes: sl.estimated_waiting?.seconds ? Math.round(sl.estimated_waiting.seconds / 60) : undefined
        };
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

    const distInfo = extractYangoDistance(json, distKm);
    const realDurationMin = extractYangoDuration(json, durationMin);

    const chosenPrice = priceEconom || priceConfort || priceMoto || 0;
    const hasJams = Boolean(
      json.jams === true ||
      serviceLevels.some((sl: any) =>
        (typeof sl.paid_options?.value === 'number' && sl.paid_options.value > 1) ||
        Boolean(sl.paid_options?.alert_properties)
      )
    );

    return {
      success: chosenPrice > 0,
      source: 'yango_live',
      price: chosenPrice,
      priceFormatted: chosenPrice > 0 ? `${chosenPrice.toLocaleString('fr-FR')} ${cityCurrency}` : 'Non disponible',
      distanceKm: distInfo.distanceKm,
      distanceMeters: distInfo.distanceMeters,
      durationMinutes: realDurationMin,
      jams: hasJams,
      yangoUnavailable: primaryClassUnavailable,
      yangoWaitingMinutes: estimatedWaitingMinutes,
      yangoUnavailableClasses: unavailableClasses,
      availableCars: availableCarsList,
      classes,
      availableClasses: Object.keys(classes),
      priceEconom: priceEconom || undefined,
      priceConfort: priceConfort || undefined,
      priceConfortPlus: priceConfortPlus || undefined,
      priceMoto: priceMoto || undefined,
      waitingTimeMinutes: estimatedWaitingMinutes || 3,
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
