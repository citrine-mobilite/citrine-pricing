import { SystemSettings } from '../types.js';
import { calculateDistanceKm } from './yangoService.js';

export let tripMasterSettings: SystemSettings = {
  id: 'tripmaster',
  searchVehicleEndpoint: 'https://tripmastercameroon.com/search-vehicle',
  distanceEndpoint: 'https://tripmastercameroon.com/get-distance',
  mode: 'real',
  requestDelayMs: 250,
  enabled: true,
  updatedAt: new Date().toISOString()
};

export function updateTripMasterSettings(newSettings: Partial<SystemSettings>) {
  tripMasterSettings = { ...tripMasterSettings, ...newSettings, updatedAt: new Date().toISOString() };
}

let cachedTmCookie = '';
let cachedTmToken = '';
let cachedTmTimestamp = 0;

export async function getTripMasterSession(signal?: AbortSignal): Promise<{ cookie: string; token: string }> {
  const now = Date.now();
  if (cachedTmToken && cachedTmCookie && (now - cachedTmTimestamp < 300000)) {
    return { cookie: cachedTmCookie, token: cachedTmToken };
  }

  try {
    const res = await fetch('https://tripmastercameroon.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal
    });

    const rawCookies = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    cachedTmCookie = rawCookies.map((c: string) => c.split(';')[0]).join('; ');
    const html = await res.text();
    const tokenMatch = html.match(/name=["']_token["']\s+value=["']([^"']+)["']/i) ||
                      html.match(/content=["']([^"']+)["']\s+name=["']csrf-token["']/i);
    cachedTmToken = tokenMatch ? tokenMatch[1] : '';
    cachedTmTimestamp = now;
    return { cookie: cachedTmCookie, token: cachedTmToken };
  } catch (e: any) {
    console.warn('[TripMaster] Erreur de session/CSRF:', e.message);
    return { cookie: '', token: '' };
  }
}

export function parseTripMasterNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  if (!val) return 0;
  const str = String(val).replace(/CFA|FCFA|XAF/gi, '').replace(/\s+/g, '').replace(/,/g, '.');
  const clean = str.replace(/[^\d.]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num);
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

  let priceEco = 0;
  let priceConfort = 0;
  let priceMoto = 0;
  let httpStatus = 200;
  let searchHtml = '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const { cookie, token } = await getTripMasterSession(signal || controller.signal);

    if (token) {
      const postData = new URLSearchParams({
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
      });

      const searchRes = await fetch(tripMasterSettings.searchVehicleEndpoint || 'https://tripmastercameroon.com/search-vehicle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://tripmastercameroon.com/'
        },
        body: postData,
        signal: signal || controller.signal
      });

      httpStatus = searchRes.status;
      searchHtml = await searchRes.text();

      // Décryptage officiel des tarifs réels Trip Master
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
    }

    clearTimeout(timeoutId);
  } catch (err: any) {
    // Timeout ou erreur réseau
  }

  const isSuccess = Boolean(priceEco || priceConfort || priceMoto);

  return {
    success: isSuccess,
    source: 'tripmaster_live',
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
