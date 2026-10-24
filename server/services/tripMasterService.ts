import { SystemSettings } from '../types.js';
import { calculateDistanceKm } from './yangoService.js';
import { pooledGet, pooledPostUrlEncoded } from '../utils/httpPool.js';

export let tripMasterSettings: SystemSettings = {
  id: 'tripmaster',
  searchVehicleEndpoint: 'https://tripmastercameroon.com/search-vehicle',
  distanceEndpoint: 'https://tripmastercameroon.com/get-distance',
  mode: 'real', // 100% requêtes HTTP réelles en direct
  requestDelayMs: 0,
  enabled: true,
  updatedAt: new Date().toISOString()
};

export function updateTripMasterSettings(newSettings: Partial<SystemSettings>) {
  tripMasterSettings = { ...tripMasterSettings, ...newSettings, updatedAt: new Date().toISOString() };
}

let cachedTmCookie = '';
let cachedTmToken = '';
let cachedTmTimestamp = 0;
let sessionPromise: Promise<{ cookie: string; token: string }> | null = null;

export async function getTripMasterSession(): Promise<{ cookie: string; token: string }> {
  const now = Date.now();
  if (cachedTmToken && cachedTmCookie && (now - cachedTmTimestamp < 900000)) { // Valide 15 minutes
    return { cookie: cachedTmCookie, token: cachedTmToken };
  }

  if (sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = (async () => {
    try {
      const res = await pooledGet('https://tripmastercameroon.com/', {}, 10000);
      const setCookies = res.headers['set-cookie'];
      const rawCookies = Array.isArray(setCookies) ? setCookies : [setCookies].filter(Boolean);
      cachedTmCookie = (rawCookies as string[]).map((c: string) => c.split(';')[0]).join('; ');
      
      const html = res.body;
      const tokenMatch = html.match(/name=["']_token["']\s+value=["']([^"']+)["']/i) ||
                        html.match(/content=["']([^"']+)["']\s+name=["']csrf-token["']/i);
      cachedTmToken = tokenMatch ? tokenMatch[1] : '';
      cachedTmTimestamp = Date.now();
      return { cookie: cachedTmCookie, token: cachedTmToken };
    } catch (e: any) {
      console.warn('[TripMaster] Erreur de session/CSRF:', e.message);
      return { cookie: '', token: '' };
    } finally {
      sessionPromise = null;
    }
  })();

  return sessionPromise;
}

export function parseTripMasterNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  if (!val) return 0;
  const str = String(val).replace(/CFA|FCFA|XAF/gi, '').replace(/\s+/g, '').replace(/,/g, '.');
  const clean = str.replace(/[^\d.]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num);
}

const tmCache = new Map<string, { priceEco: number; priceConfort: number; priceMoto: number; timestamp: number }>();

export function computeTripMasterMathematicalPrices(distKm: number, durationMin: number) {
  const km = Math.max(0.1, distKm);
  const dur = Math.max(2, durationMin);

  // Barème Trip Master Cameroun
  const priceEco = Math.max(1000, Math.round(450 + 240 * km + 10 * dur));
  const priceConfort = Math.max(1000, Math.round(550 + 280 * km + 15 * dur));
  const priceMoto = Math.max(200, Math.round(150 + 110 * km + 8 * dur));

  return { priceEco, priceConfort, priceMoto };
}

export async function callTripMasterStats(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  cityCurrency: string = 'XAF',
  originName: string = 'Départ',
  destName: string = 'Destination',
  signal?: AbortSignal
): Promise<{
  success: boolean;
  source: string;
  distanceKm: number;
  durationMinutes: number;
  priceEco?: number;
  priceConfort?: number;
  priceMoto?: number;
  latencyMs: number;
  httpStatus?: number;
  errorMessage?: string;
  rawText?: string;
  rawResponse?: any;
}> {
  const startTime = Date.now();
  const distKm = calculateDistanceKm(startLat, startLng, endLat, endLng);
  const durationMin = Math.max(2, Math.round((distKm / 25) * 60));

  if (tripMasterSettings.enabled === false) {
    return {
      success: false,
      source: 'tripmaster_disabled',
      distanceKm: distKm,
      durationMinutes: durationMin,
      latencyMs: 0,
      errorMessage: 'Agrégateur Trip Master désactivé'
    };
  }

  // Cache mémoire pour trajets identiques dans la même heure
  const cacheKey = `${distKm.toFixed(1)}km_${originName}_${destName}`;
  const cached = tmCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 1800000)) {
    return {
      success: true,
      source: 'tripmaster_cache',
      distanceKm: distKm,
      durationMinutes: durationMin,
      priceEco: cached.priceEco,
      priceConfort: cached.priceConfort,
      priceMoto: cached.priceMoto,
      latencyMs: Date.now() - startTime,
      httpStatus: 200
    };
  }

  // Si explicitement configuré en mode 'formula'
  if (tripMasterSettings.mode === 'formula') {
    const math = computeTripMasterMathematicalPrices(distKm, durationMin);
    return {
      success: true,
      source: 'tripmaster_formula_calibrated',
      distanceKm: distKm,
      durationMinutes: durationMin,
      priceEco: math.priceEco,
      priceConfort: math.priceConfort,
      priceMoto: math.priceMoto,
      latencyMs: Date.now() - startTime,
      httpStatus: 200
    };
  }

  let priceEco = 0;
  let priceConfort = 0;
  let priceMoto = 0;
  let httpStatus = 200;
  let searchHtml = '';

  try {
    const { cookie, token } = await getTripMasterSession();

    if (token) {
      const postData = {
        _token: token,
        pickup_location: originName || 'Départ',
        pickup_lat: String(startLat),
        pickup_long: String(startLng),
        pickup_city: 'Douala',
        distance: String(distKm.toFixed(2)),
        pickup_date: new Date().toISOString().split('T')[0],
        pickup_time: '12:00',
        day: 'Mon',
        booking_type: 'Normal',
        drop_location: destName || 'Arrivée',
        drop_lat: String(endLat),
        drop_long: String(endLng)
      };

      const res = await pooledPostUrlEncoded(
        tripMasterSettings.searchVehicleEndpoint || 'https://tripmastercameroon.com/search-vehicle',
        postData,
        {
          'Cookie': cookie,
          'Referer': 'https://tripmastercameroon.com/'
        },
        10000
      );

      httpStatus = res.status;
      searchHtml = res.body;

      // Parsing du tarif réel Trip Master
      const officialCardRegex = /<p[^>]*class=["'][^"']*ride-car-name[^"']*["'][^>]*>([^<]+)<\/p>[\s\S]*?<span[^>]*class=["'][^"']*ride-price-cab[^"']*["'][^>]*>([^<]+)<\/span>/gi;
      let m;
      while ((m = officialCardRegex.exec(searchHtml)) !== null) {
        const rawName = m[1].trim().toLowerCase();
        const p = parseTripMasterNumber(m[2]);
        if (p > 0) {
          if (rawName.includes('confort') || rawName.includes('berline') || rawName.includes('vip')) {
            priceConfort = p;
          } else if (rawName.includes('moto') || rawName.includes('bike')) {
            priceMoto = p;
          } else {
            priceEco = p;
          }
        }
      }

      // Deuxième passe si le HTML a une structure légèrement différente
      if (priceEco === 0 && priceConfort === 0) {
        const anyPriceMatches = searchHtml.match(/class=["'][^"']*ride-price-cab[^"']*["'][^>]*>([^<]+)<\/span>/gi) || [];
        for (const tag of anyPriceMatches) {
          const valMatch = tag.match(/>([^<]+)<\/span>/);
          if (valMatch) {
            const p = parseTripMasterNumber(valMatch[1]);
            if (p > 0 && priceEco === 0) priceEco = p;
            else if (p > 0 && priceConfort === 0) priceConfort = p;
          }
        }
      }
    }
  } catch (err: any) {
    // Erreur réseau ou timeout
  }

  const isSuccess = Boolean(priceEco || priceConfort || priceMoto);
  if (isSuccess) {
    tmCache.set(cacheKey, { priceEco, priceConfort, priceMoto, timestamp: Date.now() });
  }

  return {
    success: isSuccess,
    source: isSuccess ? 'tripmaster_live' : 'tripmaster_no_vehicles',
    distanceKm: distKm,
    durationMinutes: durationMin,
    priceEco: priceEco || undefined,
    priceConfort: priceConfort || undefined,
    priceMoto: priceMoto || undefined,
    latencyMs: Date.now() - startTime,
    httpStatus,
    errorMessage: isSuccess ? undefined : 'Aucun tarif disponible via Trip Master',
    rawText: searchHtml,
    rawResponse: searchHtml
  };
}
