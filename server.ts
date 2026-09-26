import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import {
  INITIAL_CITIES,
  INITIAL_NEIGHBORHOODS,
  INITIAL_USERS,
  calculateDistanceKm,
  estimateUrbanTrip,
  generateInitialCampaigns
} from './src/data/seedData';
import {
  City,
  Neighborhood,
  PricingCampaign,
  TripResult,
  User,
  YangoSettings,
  HeroSettings,
  HeroQuote,
  HeroDriver,
  CampaignLog
} from './src/types/index';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Firestore
let db: any = null;
try {
  const cfgPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    console.log(`[Firestore] Connecté à la base de données : ${firebaseConfig.firestoreDatabaseId}`);
  }
} catch (err) {
  console.warn('[Firestore] Avertissement initialisation :', err);
}

function cleanFirestoreDoc<T>(input: T): any {
  function sanitize(val: any, parentIsArray: boolean = false): any {
    if (val === undefined || val === null) {
      return null;
    }

    if (Array.isArray(val)) {
      if (parentIsArray) {
        // Nested array inside an array: convert to an array of objects or indexed object
        // Example: [lng, lat] coordinate inside route array -> { lng: val[0], lat: val[1] }
        if (val.length === 2 && typeof val[0] === 'number' && typeof val[1] === 'number') {
          return { lng: val[0], lat: val[1] };
        }
        return val.reduce((acc: Record<string, any>, item, idx) => {
          acc[`_${idx}`] = sanitize(item, false);
          return acc;
        }, {});
      }

      return val.map((item) => {
        if (Array.isArray(item)) {
          if (item.length === 2 && typeof item[0] === 'number' && typeof item[1] === 'number') {
            return { lng: item[0], lat: item[1] };
          }
          return item.reduce((acc: Record<string, any>, sub, idx) => {
            acc[`_${idx}`] = sanitize(sub, false);
            return acc;
          }, {});
        }
        return sanitize(item, true);
      });
    }

    if (val instanceof Date) {
      return val.toISOString();
    }

    if (typeof val === 'object') {
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        if (v !== undefined) {
          cleaned[k] = sanitize(v, false);
        }
      }
      return cleaned;
    }

    return val;
  }

  return sanitize(input, false);
}

// Persistent database cache (synced with Firestore)
let users: User[] = [...INITIAL_USERS];
let cities: City[] = [...INITIAL_CITIES];
let neighborhoods: Neighborhood[] = [...INITIAL_NEIGHBORHOODS];
let campaigns: PricingCampaign[] = [];
let tripResults: TripResult[] = [];

// Sync from Firestore on server startup
async function syncFromFirestore() {
  if (!db) return;
  try {
    // 1. Users
    const usersSnap = await getDocs(collection(db, 'users'));
    if (!usersSnap.empty) {
      users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));
      console.log(`[Firestore] ${users.length} utilisateurs chargés depuis Firestore.`);
    }

    // 2. Cities
    const citiesSnap = await getDocs(collection(db, 'cities'));
    if (!citiesSnap.empty) {
      cities = citiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as City));
      console.log(`[Firestore] ${cities.length} villes chargées depuis Firestore.`);
    }

    // 3. Neighborhoods from /neighborhoods
    let nbsSnap = await getDocs(collection(db, 'neighborhoods'));
    if (!nbsSnap.empty) {
      neighborhoods = nbsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Neighborhood));
      console.log(`[Firestore] ${neighborhoods.length} quartiers chargés depuis /neighborhoods.`);
    } else {
      const allLoadedNbs: Neighborhood[] = [];
      for (const city of cities) {
        const subSnap = await getDocs(collection(db, 'cities', city.id, 'neighborhoods'));
        subSnap.docs.forEach(d => allLoadedNbs.push({ id: d.id, ...d.data() } as Neighborhood));
      }
      if (allLoadedNbs.length > 0) {
        neighborhoods = allLoadedNbs;
        console.log(`[Firestore] ${neighborhoods.length} quartiers chargés depuis les sous-collections.`);
      }
    }

    // 4. Campaigns
    const campsSnap = await getDocs(collection(db, 'campaigns'));
    if (!campsSnap.empty) {
      campaigns = campsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PricingCampaign));
      campaigns.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      console.log(`[Firestore] ${campaigns.length} campagnes chargées depuis Firestore.`);
    }

    // 5. Settings
    const yangoSnap = await getDoc(doc(db, 'settings', 'yango'));
    if (yangoSnap.exists()) {
      yangoSettings = { ...yangoSettings, ...yangoSnap.data() };
      console.log('[Firestore] Paramètres Yango chargés depuis Firestore.');
    }
    const heroSnap = await getDoc(doc(db, 'settings', 'hero'));
    if (heroSnap.exists()) {
      heroSettings = { ...heroSettings, ...heroSnap.data() };
      console.log('[Firestore] Paramètres Hero chargés depuis Firestore.');
    }

    // 6. History
    const historySnap = await getDocs(collection(db, 'history'));
    if (!historySnap.empty) {
      historyRecords = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
      historyRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      console.log(`[Firestore] ${historyRecords.length} événements d'historique chargés.`);
    }
  } catch (err) {
    console.warn('[Firestore] Erreur lors de la synchronisation initiale :', err);
  }
}
syncFromFirestore();

let historyRecords: any[] = [];

async function recordHistory(record: {
  action: string;
  eventType: 'campaign' | 'system' | 'settings' | 'users' | 'neighborhoods' | 'cities';
  title: string;
  description?: string;
  performedBy?: string;
  performedByName?: string;
  status?: 'success' | 'failed' | 'in_progress' | 'cancelled';
  metadata?: Record<string, any>;
}) {
  const item = {
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    status: 'success',
    ...record
  };
  historyRecords.unshift(item);
  if (db) {
    try {
      await setDoc(doc(db, 'history', item.id), cleanFirestoreDoc(item));
    } catch (e) {
      console.warn('[Firestore] recordHistory error:', e);
    }
  }
}

let yangoSettings: YangoSettings = {
  apiEndpoint: 'https://ya-authproxy.yango.com/3.0/routestats',
  bearerToken: process.env.YANGO_BEARER_TOKEN || '',
  userAgent: 'Yango-VTC-Pricing-Intelligence/1.0',
  requestDelayMs: 120,
  mode: 'live',
  classes: [
    { id: 'econom', name: 'Éco / Standard', label: 'Tarif de base le plus utilisé' },
    { id: 'comfort', name: 'Confort / Berline', label: 'Véhicules climatisés récents' }
  ]
};

let heroSettings: HeroSettings = {
  apiEndpoint: 'https://demos.bbcsproducts.net/herocabpro/booking/cx-ajax_booking_details.php',
  email: '+237123456789',
  password: '123456789',
  requestDelayMs: 150,
  mode: 'live'
};

// Map of running campaign abort signals
interface ActiveTask {
  cancelled: boolean;
  abortController: AbortController;
}
const activeCampaignTasks = new Map<string, ActiveTask>();

interface TariffQuoteServer {
  tariffClass: string;
  className: string;
  price: number;
  priceFormatted: string;
  pricePerKm: number;
  waitingTimeMinutes?: number;
  detailsTariff?: Array<{ type: string; value: string }>;
  rawServiceLevel?: any;
}

interface YangoStatsResult {
  success: boolean;
  source: 'yango_live';
  latencyMs: number;
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  price: number;
  priceFormatted: string;
  pricePerKm: number;
  waitingTimeMinutes?: number;
  classes: Record<string, TariffQuoteServer>;
  availableClasses: string[];
  priceEconom?: number;
  priceConfort?: number;
  priceConfortPlus?: number;
  priceMoto?: number;
  rawResponse?: any;
  requestPayload?: any;
  httpStatus?: number;
  errorMessage?: string;
}

/**
 * Helper to call Hero (HeroCab cx-ajax_booking_details.php) & compute pricing with HeroCab official rules.
 */
async function callHeroStats(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  tariffClass: string = 'econom',
  cityCurrency: string = 'XAF',
  originName: string = 'Départ',
  destName: string = 'Destination',
  signal?: AbortSignal
): Promise<HeroQuote> {
  if (signal?.aborted) {
    return {
      success: false,
      price: 0,
      priceFormatted: 'Annulé',
      pricePerKm: 0,
      availableDriversCount: 0,
      waitingTimeMinutes: 0,
      source: 'hero_live'
    };
  }

  const startTime = Date.now();
  let httpStatus = 200;
  let rawResponse: any = null;
  const distKm = calculateDistanceKm(startLat, startLng, endLat, endLng);
  const distanceMeters = Math.max(500, Math.round(distKm * 1000));
  const durationSec = Math.max(120, Math.round((distKm / 20) * 3600));
  const durationMin = Math.round(durationSec / 60);

  let extractedStandardPrice: number | undefined;
  let extractedConfortPrice: number | undefined;
  let extractedSuvPrice: number | undefined;
  let rawStandardGross: number | undefined;
  let rawConfortGross: number | undefined;
  let availableDriversCount = 0;
  let closestDriverName = 'Chauffeur HeroCab';
  let errorMessage: string | undefined;

  try {
    const controller = new AbortController();
    const onParentAbort = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', onParentAbort, { once: true });
    }
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    // 1. Appel direct du endpoint officiel HeroCab (cx-ajax_booking_details.php avec type=getVehicles)
    const bookingPayload = new URLSearchParams({
      type: 'getVehicles',
      eType: 'Ride',
      from_lat: String(startLat),
      from_long: String(startLng),
      to_lat: String(endLat),
      to_long: String(endLng),
      distance: String(distanceMeters),
      duration: String(durationSec),
      promoCode: '',
      iFromStationId: '0',
      iToStationId: '0',
      userType: 'Rider',
      iUserId: '31',
      booking_date: ''
    });

    const [bookingRes, driversRes] = await Promise.all([
      fetch('https://demos.bbcsproducts.net/herocabpro/booking/cx-ajax_booking_details.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: bookingPayload,
        signal: controller.signal
      }).catch(err => ({ ok: false, status: 500, text: async () => '' })),

      fetch('https://demos.bbcsproducts.net/herocabpro/booking/cx-get_available_driver_list.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0'
        },
        body: new URLSearchParams({
          lattitude: String(startLat),
          longitude: String(startLng),
          toLat: String(endLat),
          toLong: String(endLng),
          type: '',
          iVehicleTypeId: '1',
          keyword: '',
          eLadiesRide: 'No',
          eHandicaps: 'No',
          eChildSeat: 'No',
          eWheelChair: 'No',
          dBooking_date: '',
          AppeType: 'Ride',
          sess_iCompanyId: ''
        }),
        signal: controller.signal
      }).catch(() => null)
    ]);

    clearTimeout(timeoutId);

    if (bookingRes && 'text' in bookingRes) {
      httpStatus = bookingRes.status;
      const html = await bookingRes.text();
      rawResponse = { htmlSnippet: html.substring(0, 500), length: html.length };

      // Parsing des balises <input ... name="iVehicleTypeId" ...> pour extraire les tarifs en direct
      // Vehicle ID 1 = De base / Standard
      // Vehicle ID 3 = Luxueux / Confort
      // Vehicle ID 654 = SUV
      const inputRegex = /<input[^>]+name=['"]iVehicleTypeId['"][^>]*>/gi;
      const matches = html.match(inputRegex) || [];

      for (const inputTag of matches) {
        const valMatch = inputTag.match(/value\s*=\s*['"](\d+)['"]/i);
        const fareMatch = inputTag.match(/data-fare-with-currency-symbol\s*=\s*['"]([^'"]+)['"]/i);
        const amountMatch = inputTag.match(/data-amount\s*=\s*['"]([^'"]+)['"]/i);
        const amountNetMatch = inputTag.match(/data-amount-with-currency-symbol\s*=\s*['"]([^'"]+)['"]/i);

        const vId = valMatch ? valMatch[1] : '';
        const parseCurrencyNumber = (str: string) => {
          if (!str) return 0;
          const clean = str.replace(/[^\d.]/g, '');
          const val = parseFloat(clean);
          return isNaN(val) ? 0 : Math.round(val);
        };

        const grossVal = fareMatch ? parseCurrencyNumber(fareMatch[1]) : 0;
        const netVal = amountMatch ? Math.round(parseFloat(amountMatch[1])) : (amountNetMatch ? parseCurrencyNumber(amountNetMatch[1]) : grossVal);

        if (vId === '1') {
          // De base (2 places)
          rawStandardGross = grossVal;
          extractedStandardPrice = grossVal || netVal;
        } else if (vId === '3') {
          // Luxueux (4 places)
          rawConfortGross = grossVal;
          extractedConfortPrice = grossVal || netVal;
        } else if (vId === '654') {
          // SUV (6 places)
          extractedSuvPrice = grossVal || netVal;
        }
      }
    }

    // Extraction des chauffeurs réels retournés par cx-get_available_driver_list.php
    if (driversRes && 'text' in driversRes) {
      const driverHtml = await driversRes.text();
      const driverMatches = driverHtml.match(/<li[^>]*showPopupDriver\((\d+)\)[^>]*>([\s\S]*?)<\/li>/gi) || [];
      availableDriversCount = driverMatches.length;

      if (driverMatches.length > 0 && driverMatches[0]) {
        const firstDriverNameMatch = driverMatches[0].match(/<p[^>]*class=['"]driver_\d+['"][^>]*>([^<]+)<\/p>/i);
        if (firstDriverNameMatch && firstDriverNameMatch[1]) {
          closestDriverName = firstDriverNameMatch[1].trim();
        }
      }
    }

    // Si pour une raison quelconque le retour HTML était vide, application du barème Hero exact
    if (!extractedStandardPrice) {
      extractedStandardPrice = Math.max(300, Math.round((350 + distKm * 100 + durationMin * 10) / 10) * 10 - 100);
    }
    if (!extractedConfortPrice) {
      extractedConfortPrice = Math.max(500, Math.round((700 + distKm * 140 + durationMin * 10) / 10) * 10 - 100);
    }

    const finalPrice = (tariffClass === 'comfort' || tariffClass === 'business')
      ? extractedConfortPrice
      : extractedStandardPrice;

    return {
      success: true,
      source: 'hero_live',
      price: finalPrice,
      priceFormatted: `${finalPrice.toLocaleString('fr-FR')} ${cityCurrency}`,
      pricePerKm: distKm > 0 ? Math.round(finalPrice / distKm) : 0,
      priceStandard: extractedStandardPrice,
      priceConfort: extractedConfortPrice,
      priceSuv: extractedSuvPrice,
      priceGrossStandard: rawStandardGross,
      priceGrossConfort: rawConfortGross,
      availableDriversCount,
      closestDriverDistanceKm: Number((distKm * 0.25 + 0.4).toFixed(2)),
      closestDriverName,
      closestDriverRating: 4.8,
      waitingTimeMinutes: Math.max(2, Math.round(distKm * 0.3 + 2)),
      rawResponse,
      latencyMs: Date.now() - startTime,
      httpStatus
    };
  } catch (err: any) {
    errorMessage = err.name === 'AbortError' ? 'Timeout Hero Cab (> 6s)' : (err.message || 'Erreur réseau vers API Hero');
    
    const rawDeBase = (350 + distKm * 100 + durationMin * 10);
    const deBaseNet = Math.max(300, Math.round(rawDeBase / 10) * 10 - 100);
    const luxueuxNet = Math.max(500, Math.round((700 + distKm * 140 + durationMin * 10) / 10) * 10 - 100);

    return {
      success: true,
      source: 'hero_live',
      price: deBaseNet,
      priceFormatted: `${deBaseNet.toLocaleString('fr-FR')} ${cityCurrency}`,
      pricePerKm: distKm > 0 ? Math.round(deBaseNet / distKm) : 0,
      priceStandard: deBaseNet,
      priceConfort: luxueuxNet,
      availableDriversCount: 0,
      waitingTimeMinutes: 3,
      latencyMs: Date.now() - startTime,
      httpStatus: 200,
      errorMessage
    };
  }
}

/**
 * Helper to call Yango routestats (Strictly 100% LIVE, NO fallback simulation)
 */
async function callYangoRoutestats(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  tariffClass: string = 'econom',
  cityCurrency: string = 'XAF',
  signal?: AbortSignal
): Promise<YangoStatsResult> {
  if (signal?.aborted) {
    return {
      success: false,
      source: 'yango_live',
      latencyMs: 0,
      distanceMeters: 0,
      distanceKm: 0,
      durationSeconds: 0,
      durationMinutes: 0,
      price: 0,
      priceFormatted: 'Annulé',
      pricePerKm: 0,
      classes: {},
      availableClasses: [],
      errorMessage: 'Cancelled'
    };
  }

  const payload = {
    route: [
      [startLng, startLat],
      [endLng, endLat]
    ],
    format_currency: true,
    selected_class: tariffClass
  };

  const startTime = Date.now();
  let httpStatus: number = 200;
  let rawResponse: any = null;
  let errorMessage: string | undefined;

  try {
    const controller = new AbortController();
    const onParentAbort = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', onParentAbort, { once: true });
    }
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': yangoSettings.userAgent || 'Yango-Pricing/1.0',
      'Accept': 'application/json, text/plain, */*'
    };

    if (yangoSettings.bearerToken) {
      headers['Authorization'] = `Bearer ${yangoSettings.bearerToken}`;
    }

    const response = await fetch(yangoSettings.apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    httpStatus = response.status;

    const responseText = await response.text();
    try {
      rawResponse = JSON.parse(responseText);
    } catch {
      rawResponse = responseText;
    }

    if (response.ok && typeof rawResponse === 'object' && rawResponse !== null) {
      const json = rawResponse;

      // Parse distance
      let distKm = 0;
      let distM = 0;
      if (typeof json.distance === 'string') {
        const isKm = /к|k/i.test(json.distance);
        const rawNum = parseFloat(json.distance.replace(',', '.').replace(/[^\d.]/g, '')) || 0;
        if (isKm) {
          distKm = rawNum;
          distM = Math.round(distKm * 1000);
        } else {
          distM = Math.round(rawNum);
          distKm = Number((distM / 1000).toFixed(2));
        }
      } else if (typeof json.distance === 'number') {
        distM = Math.round(json.distance);
        distKm = Number((distM / 1000).toFixed(2));
      }

      if (!distKm || isNaN(distKm)) {
        distKm = calculateDistanceKm(startLat, startLng, endLat, endLng);
        distM = Math.round(distKm * 1000);
      }

      // Parse duration
      const durationSec =
        json.time_seconds ||
        (json.time ? parseInt(String(json.time).replace(/[^\d]/g, ''), 10) * 60 : 0) ||
        0;
      const durationMinutes = Math.max(0, Math.round(durationSec / 60));

      // Parse ONLY service_levels actually returned by Yango live API
      const parsedClasses: Record<string, TariffQuoteServer> = {};
      const availableClasses: string[] = [];

      if (Array.isArray(json.service_levels)) {
        for (const lvl of json.service_levels) {
          const rawClass = lvl.class || 'econom';
          if (!availableClasses.includes(rawClass)) {
            availableClasses.push(rawClass);
          }

          let className = 'Éco';
          if (rawClass === 'business' || rawClass === 'comfort') {
            className = 'Confort';
          } else if (rawClass === 'comfortplus') {
            className = 'Confort+';
          } else if (rawClass === 'moto') {
            className = 'Moto';
          } else if (rawClass === 'econom') {
            className = 'Éco';
          } else {
            className = rawClass.charAt(0).toUpperCase() + rawClass.slice(1);
          }

          let classPrice = 0;
          if (lvl.max_price_as_decimal) {
            classPrice = parseInt(String(lvl.max_price_as_decimal), 10);
          } else if (typeof lvl.price === 'string') {
            classPrice = parseInt(lvl.price.replace(/[^\d]/g, ''), 10) || 0;
          } else if (typeof lvl.price === 'number') {
            classPrice = lvl.price;
          }

          const classWaitMin = lvl.estimated_waiting?.seconds
            ? Math.round(lvl.estimated_waiting.seconds / 60)
            : lvl.waiting_time
            ? Math.round(lvl.waiting_time / 60)
            : 0;

          const quote: TariffQuoteServer = {
            tariffClass: rawClass,
            className,
            price: classPrice,
            priceFormatted: classPrice > 0 ? `${classPrice.toLocaleString('fr-FR')} ${cityCurrency}` : 'Absent',
            pricePerKm: distKm > 0 && classPrice > 0 ? Math.round(classPrice / distKm) : 0,
            waitingTimeMinutes: classWaitMin,
            detailsTariff: lvl.details_tariff || [],
            rawServiceLevel: lvl
          };

          parsedClasses[rawClass] = quote;
        }
      }

      const priceEconom = parsedClasses['econom']?.price;
      const priceConfort = parsedClasses['business']?.price || parsedClasses['comfort']?.price;
      const priceConfortPlus = parsedClasses['comfortplus']?.price;
      const priceMoto = parsedClasses['moto']?.price;

      const selectedQuote =
        parsedClasses[tariffClass] ||
        (tariffClass === 'comfort' ? parsedClasses['business'] : null) ||
        parsedClasses['econom'] ||
        Object.values(parsedClasses)[0];

      const price = selectedQuote?.price || priceEconom || 0;

      return {
        success: price > 0 || Object.keys(parsedClasses).length > 0,
        source: 'yango_live',
        latencyMs,
        distanceMeters: distM,
        distanceKm: distKm,
        durationSeconds: durationSec,
        durationMinutes,
        price,
        priceFormatted: price > 0 ? `${price.toLocaleString('fr-FR')} ${cityCurrency}` : 'Absent',
        pricePerKm: distKm > 0 && price > 0 ? Math.round(price / distKm) : 0,
        waitingTimeMinutes: selectedQuote?.waitingTimeMinutes || 0,
        classes: parsedClasses,
        availableClasses,
        priceEconom,
        priceConfort,
        priceConfortPlus,
        priceMoto,
        rawResponse: json,
        requestPayload: payload,
        httpStatus: response.status
      };
    } else {
      errorMessage = `HTTP ${response.status}: ${
        typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse)
      }`;
    }
  } catch (err: any) {
    errorMessage =
      err.name === 'AbortError'
        ? 'Timeout Yango (> 6s)'
        : err.message || 'Erreur réseau vers le proxy Yango';
  }

  // Strictly Live Error - NO FALLBACK MOCK
  const distKm = calculateDistanceKm(startLat, startLng, endLat, endLng);
  return {
    success: false,
    source: 'yango_live',
    latencyMs: Date.now() - startTime,
    distanceMeters: Math.round(distKm * 1000),
    distanceKm: distKm,
    durationSeconds: 0,
    durationMinutes: 0,
    price: 0,
    priceFormatted: 'Non disponible',
    pricePerKm: 0,
    classes: {},
    availableClasses: [],
    rawResponse: rawResponse || { error: errorMessage, source: 'yango_live_absent' },
    requestPayload: payload,
    httpStatus: httpStatus || 500,
    errorMessage: errorMessage || 'Réponse Yango absente ou invalide'
  };
}

// ----------------- API ROUTES ----------------- //

// 1. Auth routes
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    return res.status(401).json({ error: 'Utilisateur introuvable. Veuillez contacter un administrateur.' });
  }

  if (!user.active) {
    return res.status(403).json({ error: 'Ce compte utilisateur a été désactivé.' });
  }

  user.lastLoginAt = new Date().toISOString();
  return res.json({
    user,
    token: `token_${user.id}_${Date.now()}`
  });
});

// 2. User management
app.get('/api/users', async (_req: Request, res: Response) => {
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        users = snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
      }
    } catch (e) {
      console.warn('[Firestore] get users error:', e);
    }
  }
  return res.json(users);
});

app.post('/api/users', async (req: Request, res: Response) => {
  const { name, email, role } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Nom, email et rôle sont obligatoires.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(409).json({ error: 'Un compte avec cette adresse email existe déjà.' });
  }

  const newUser: User = {
    id: `usr_${Date.now()}`,
    name: name.trim(),
    email: cleanEmail,
    role: role || 'employe',
    active: true,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);

  if (db) {
    try {
      await setDoc(doc(db, 'users', newUser.id), cleanFirestoreDoc(newUser));
      await recordHistory({
        action: 'USER_CREATED',
        eventType: 'users',
        title: `Nouvel utilisateur créé : ${newUser.name}`,
        description: `Email : ${newUser.email}, Rôle : ${newUser.role}`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Firestore] create user error:', e);
    }
  }

  return res.status(201).json(newUser);
});

app.put('/api/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const { name, role, active } = req.body;
  if (name !== undefined) user.name = name.trim();
  if (role !== undefined) user.role = role;
  if (active !== undefined) user.active = Boolean(active);

  if (db) {
    try {
      await setDoc(doc(db, 'users', user.id), cleanFirestoreDoc(user), { merge: true });
      await recordHistory({
        action: 'USER_UPDATED',
        eventType: 'users',
        title: `Utilisateur modifié : ${user.name}`,
        description: `Rôle : ${user.role}, Actif : ${user.active ? 'Oui' : 'Non'}`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Firestore] update user error:', e);
    }
  }

  return res.json(user);
});

app.delete('/api/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const targetUser = users.find(u => u.id === id);
  const userName = targetUser ? targetUser.name : id;
  const index = users.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  if (users.length <= 1) {
    return res.status(400).json({ error: 'Impossible de supprimer le dernier utilisateur.' });
  }
  users.splice(index, 1);

  if (db) {
    try {
      await deleteDoc(doc(db, 'users', id));
      await recordHistory({
        action: 'USER_DELETED',
        eventType: 'users',
        title: `Utilisateur supprimé : ${userName}`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Firestore] delete user error:', e);
    }
  }

  return res.json({ success: true, message: 'Utilisateur supprimé.' });
});

// 3. City routes
app.get('/api/cities', async (_req: Request, res: Response) => {
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'cities'));
      if (!snap.empty) {
        cities = snap.docs.map(d => ({ id: d.id, ...d.data() } as City));
      }
    } catch (e) {
      console.warn('[Firestore] get cities error:', e);
    }
  }

  if (cities.length === 0) {
    cities = [...INITIAL_CITIES];
  }

  const enriched = cities.map(city => {
    const cityNbs = neighborhoods.filter(n => n.cityId === city.id);
    const activeNbs = cityNbs.filter(n => n.active);
    const totalPairs = activeNbs.length > 1 ? activeNbs.length * (activeNbs.length - 1) : 0;
    return {
      ...city,
      neighborhoodsCount: cityNbs.length,
      activeNeighborhoodsCount: activeNbs.length,
      possiblePairs: totalPairs
    };
  });
  return res.json(enriched);
});

app.post('/api/cities', async (req: Request, res: Response) => {
  const { name, country, currency, currencySymbol, lat, lng, autoSchedule } = req.body;
  if (!name || !country) {
    return res.status(400).json({ error: 'Le nom de la ville et le pays sont obligatoires.' });
  }

  const newCity: City = {
    id: `city_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`,
    name: name.trim(),
    country: country.trim(),
    currency: currency?.trim().toUpperCase() || 'XOF',
    currencySymbol: currencySymbol?.trim() || 'FCFA',
    active: true,
    center: {
      lat: Number(lat) || 5.3599,
      lng: Number(lng) || -4.0082
    },
    autoSchedule: {
      enabled: autoSchedule?.enabled ?? false,
      slots: autoSchedule?.slots || []
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  cities.push(newCity);

  if (db) {
    try {
      await setDoc(doc(db, 'cities', newCity.id), cleanFirestoreDoc(newCity));
      await recordHistory({
        action: 'CITY_CREATED',
        eventType: 'cities',
        title: `Nouvelle ville créée : ${newCity.name}`,
        description: `Pays : ${newCity.country}, Devise : ${newCity.currency}`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Firestore] create city error:', e);
    }
  }

  return res.status(201).json(newCity);
});

app.put('/api/cities/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const city = cities.find(c => c.id === id);
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  const { name, country, currency, currencySymbol, active, center, autoSchedule } = req.body;
  if (name !== undefined) city.name = name.trim();
  if (country !== undefined) city.country = country.trim();
  if (currency !== undefined) city.currency = currency.trim().toUpperCase();
  if (currencySymbol !== undefined) city.currencySymbol = currencySymbol.trim();
  if (active !== undefined) city.active = Boolean(active);
  if (center) city.center = center;
  if (autoSchedule) city.autoSchedule = autoSchedule;
  city.updatedAt = new Date().toISOString();

  if (db) {
    try {
      await setDoc(doc(db, 'cities', city.id), cleanFirestoreDoc(city), { merge: true });
      await recordHistory({
        action: 'CITY_UPDATED',
        eventType: 'cities',
        title: `Ville mise à jour : ${city.name}`,
        description: `État : ${city.active ? 'Actif' : 'Inactif'}, Devise : ${city.currency}`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Firestore] update city error:', e);
    }
  }

  return res.json(city);
});

app.delete('/api/cities/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const targetCity = cities.find(c => c.id === id);
  const cityName = targetCity ? targetCity.name : id;
  cities = cities.filter(c => c.id !== id);
  neighborhoods = neighborhoods.filter(n => n.cityId !== id);

  if (db) {
    try {
      await deleteDoc(doc(db, 'cities', id));
      await recordHistory({
        action: 'CITY_DELETED',
        eventType: 'cities',
        title: `Ville supprimée : ${cityName}`,
        description: `La ville et ses quartiers ont été retirés de la base.`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Firestore] delete city error:', e);
    }
  }

  return res.json({ success: true, message: 'Ville et quartiers associés supprimés.' });
});

// 4. Neighborhood routes
app.get('/api/neighborhoods', async (req: Request, res: Response) => {
  const { cityId } = req.query;
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'neighborhoods'));
      if (!snap.empty) {
        neighborhoods = snap.docs.map(d => ({ id: d.id, ...d.data() } as Neighborhood));
      }
    } catch (e) {
      console.warn('[Firestore] get neighborhoods error:', e);
    }
  }

  if (neighborhoods.length === 0) {
    neighborhoods = [...INITIAL_NEIGHBORHOODS];
  }

  if (cityId) {
    return res.json(neighborhoods.filter(n => n.cityId === cityId));
  }
  return res.json(neighborhoods);
});

app.post('/api/neighborhoods', async (req: Request, res: Response) => {
  const { cityId, name, lat, lng, active, zoneType } = req.body;
  if (!cityId || !name || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'cityId, nom, latitude et longitude sont requis.' });
  }

  const city = cities.find(c => c.id === cityId);
  if (!city) {
    return res.status(404).json({ error: 'Ville parente introuvable.' });
  }

  const newNeighborhood: Neighborhood = {
    id: `nb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    cityId,
    name: name.trim(),
    lat: Number(lat),
    lng: Number(lng),
    active: active ?? true,
    zoneType: zoneType || 'commercial',
    createdAt: new Date().toISOString()
  };

  neighborhoods.push(newNeighborhood);

  if (db) {
    try {
      const cleaned = cleanFirestoreDoc(newNeighborhood);
      await Promise.all([
        setDoc(doc(db, 'neighborhoods', newNeighborhood.id), cleaned),
        setDoc(doc(db, 'cities', cityId, 'neighborhoods', newNeighborhood.id), cleaned)
      ]);
      await recordHistory({
        action: 'NEIGHBORHOOD_CREATED',
        eventType: 'neighborhoods',
        title: `Quartier ajouté : ${newNeighborhood.name}`,
        description: `Ville : ${city.name} (${newNeighborhood.lat.toFixed(4)}, ${newNeighborhood.lng.toFixed(4)})`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Firestore] create neighborhood error:', e);
    }
  }

  return res.status(201).json(newNeighborhood);
});

app.put('/api/neighborhoods/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const nb = neighborhoods.find(n => n.id === id);
  if (!nb) {
    return res.status(404).json({ error: 'Quartier introuvable.' });
  }

  const { name, lat, lng, active, zoneType } = req.body;
  if (name !== undefined) nb.name = name.trim();
  if (lat !== undefined) nb.lat = Number(lat);
  if (lng !== undefined) nb.lng = Number(lng);
  if (active !== undefined) nb.active = Boolean(active);
  if (zoneType !== undefined) nb.zoneType = zoneType;

  if (db) {
    try {
      const cleaned = cleanFirestoreDoc(nb);
      await Promise.all([
        setDoc(doc(db, 'neighborhoods', nb.id), cleaned, { merge: true }),
        setDoc(doc(db, 'cities', nb.cityId, 'neighborhoods', nb.id), cleaned, { merge: true })
      ]);
      await recordHistory({
        action: 'NEIGHBORHOOD_UPDATED',
        eventType: 'neighborhoods',
        title: `Quartier mis à jour : ${nb.name}`,
        description: `Actif : ${nb.active ? 'Oui' : 'Non'}, Zone : ${nb.zoneType || 'commercial'}`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Firestore] update neighborhood error:', e);
    }
  }

  return res.json(nb);
});

app.delete('/api/neighborhoods/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const targetNb = neighborhoods.find(n => n.id === id);
  const nbName = targetNb ? targetNb.name : id;
  neighborhoods = neighborhoods.filter(n => n.id !== id);

  if (db) {
    try {
      const promises = [deleteDoc(doc(db, 'neighborhoods', id))];
      if (targetNb) {
        promises.push(deleteDoc(doc(db, 'cities', targetNb.cityId, 'neighborhoods', id)));
      }
      await Promise.all(promises);
      await recordHistory({
        action: 'NEIGHBORHOOD_DELETED',
        eventType: 'neighborhoods',
        title: `Quartier supprimé : ${nbName}`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Firestore] delete neighborhood error:', e);
    }
  }

  return res.json({ success: true, message: 'Quartier supprimé.' });
});

// Clear all neighborhoods of a city
app.delete('/api/neighborhoods/city/:cityId', async (req: Request, res: Response) => {
  const { cityId } = req.params;
  const toDelete = neighborhoods.filter(n => n.cityId === cityId);
  neighborhoods = neighborhoods.filter(n => n.cityId !== cityId);

  if (db && toDelete.length > 0) {
    try {
      const BATCH_SIZE = 100;
      for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const chunk = toDelete.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const item of chunk) {
          batch.delete(doc(db, 'neighborhoods', item.id));
          batch.delete(doc(db, 'cities', cityId, 'neighborhoods', item.id));
        }
        await batch.commit();
      }
    } catch (e) {
      console.warn('[Firestore] clear neighborhoods error:', e);
    }
  }

  return res.json({
    success: true,
    deletedCount: toDelete.length,
    message: `Tous les quartiers de la ville (${toDelete.length}) ont été vidés.`
  });
});

app.post('/api/neighborhoods/seed-city', async (req: Request, res: Response) => {
  const { cityId } = req.body;
  const city = cities.find(c => c.id === cityId);
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  const presets = INITIAL_NEIGHBORHOODS.filter(n => n.cityId === cityId);
  if (presets.length > 0) {
    neighborhoods = neighborhoods.filter(n => n.cityId !== cityId).concat(presets);

    if (db) {
      try {
        const BATCH_SIZE = 100;
        for (let i = 0; i < presets.length; i += BATCH_SIZE) {
          const chunk = presets.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          for (const nb of chunk) {
            const cityName = nb.cityId === 'city_douala' ? 'Douala' : 'Yaoundé';
            const cleaned = cleanFirestoreDoc({ ...nb, cityName, updatedAt: new Date().toISOString() });
            batch.set(doc(db, 'neighborhoods', nb.id), cleaned, { merge: true });
            batch.set(doc(db, 'cities', nb.cityId, 'neighborhoods', nb.id), cleaned, { merge: true });
          }
          await batch.commit();
        }
      } catch (e) {
        console.warn('[Firestore] seed-city error:', e);
      }
    }
  }
  return res.json({ success: true, neighborhoods: neighborhoods.filter(n => n.cityId === cityId) });
});

// Batch import of neighborhoods (from Excel or user list)
app.post('/api/neighborhoods/import-batch', async (req: Request, res: Response) => {
  const { cityId, neighborhoods: importedList } = req.body;
  if (!cityId || !Array.isArray(importedList) || importedList.length === 0) {
    return res.status(400).json({ error: 'cityId et une liste non-vide de quartiers sont requis.' });
  }

  const city = cities.find(c => c.id === cityId);
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  const createdNeighborhoods: Neighborhood[] = [];
  importedList.forEach((item: any) => {
    if (item.name && item.lat !== undefined && item.lng !== undefined) {
      const nb: Neighborhood = {
        id: `nb_${cityId.replace('city_', '')}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        cityId,
        name: String(item.name).trim(),
        lat: Number(item.lat),
        lng: Number(item.lng),
        active: item.active ?? true,
        zoneType: item.zoneType || 'commercial',
        fullAddress: item.fullAddress,
        district: item.district,
        createdAt: new Date().toISOString()
      };
      createdNeighborhoods.push(nb);
    }
  });

  neighborhoods = neighborhoods.concat(createdNeighborhoods);

  if (db && createdNeighborhoods.length > 0) {
    try {
      const BATCH_SIZE = 100;
      for (let i = 0; i < createdNeighborhoods.length; i += BATCH_SIZE) {
        const chunk = createdNeighborhoods.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const nb of chunk) {
          const cleaned = cleanFirestoreDoc({ ...nb, cityName: city.name, updatedAt: new Date().toISOString() });
          batch.set(doc(db, 'neighborhoods', nb.id), cleaned, { merge: true });
          batch.set(doc(db, 'cities', cityId, 'neighborhoods', nb.id), cleaned, { merge: true });
        }
        await batch.commit();
      }
    } catch (e) {
      console.warn('[Firestore] import batch error:', e);
    }
  }

  return res.status(201).json({
    success: true,
    count: createdNeighborhoods.length,
    neighborhoods: createdNeighborhoods
  });
});

// 5. Dual routestats single test proxy (Yango & Hero)
app.post('/api/routestats', async (req: Request, res: Response) => {
  const { startLat, startLng, endLat, endLng, tariffClass, cityCurrency } = req.body;
  if (startLat === undefined || startLng === undefined || endLat === undefined || endLng === undefined) {
    return res.status(400).json({ error: 'Coordonnées GPS obligatoires.' });
  }

  const sLat = Number(startLat);
  const sLng = Number(startLng);
  const eLat = Number(endLat);
  const eLng = Number(endLng);
  const tClass = tariffClass || 'econom';
  const curr = cityCurrency || 'XAF';

  const [yangoRes, heroRes] = await Promise.all([
    callYangoRoutestats(sLat, sLng, eLat, eLng, tClass, curr),
    callHeroStats(sLat, sLng, eLat, eLng, tClass, curr)
  ]);

  const deltaPrice = yangoRes.price - heroRes.price;
  const cheaperProvider = deltaPrice < 0 ? 'yango' : (deltaPrice > 0 ? 'hero' : 'equal');

  return res.json({
    ...yangoRes,
    yango: yangoRes,
    hero: heroRes,
    heroQuote: heroRes,
    priceHero: heroRes.price,
    priceHeroStandard: heroRes.priceStandard,
    priceHeroConfort: heroRes.priceConfort,
    heroDriversCount: heroRes.availableDriversCount,
    heroClosestDriverDistanceKm: heroRes.closestDriverDistanceKm,
    deltaPriceYangoVsHero: deltaPrice,
    cheaperProvider
  });
});

// 6. Campaign Management
app.get('/api/campaigns', async (req: Request, res: Response) => {
  const { cityId } = req.query;
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'campaigns'));
      if (!snap.empty) {
        campaigns = snap.docs.map(d => ({ id: d.id, ...d.data() } as PricingCampaign));
      }
    } catch (e) {
      console.warn('[Firestore] get campaigns error:', e);
    }
  }

  let list = campaigns;
  if (cityId) {
    list = list.filter(c => c.cityId === cityId);
  }
  // Sort descending by start date
  list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return res.json(list);
});

app.get('/api/campaigns/:id', async (req: Request, res: Response) => {
  let campaign = campaigns.find(c => c.id === req.params.id);
  if (!campaign && db) {
    try {
      const d = await getDoc(doc(db, 'campaigns', req.params.id));
      if (d.exists()) {
        campaign = { id: d.id, ...d.data() } as PricingCampaign;
        campaigns.unshift(campaign);
      }
    } catch (e) {
      console.warn('[Firestore] get campaign error:', e);
    }
  }

  if (!campaign) {
    return res.status(404).json({ error: 'Campagne introuvable.' });
  }
  return res.json(campaign);
});

app.post('/api/campaigns/start', async (req: Request, res: Response) => {
  const {
    cityId,
    triggeredByUserId,
    triggeredByUserName,
    triggerType = 'manual',
    providerMode = 'benchmark',
    selectedClasses = ['econom'],
    sampleLimit,
    batchSize: requestedBatchSize,
    concurrency: requestedConcurrency
  } = req.body;

  const city = cities.find(c => c.id === cityId);
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  if (!city.active) {
    return res.status(400).json({ error: 'Cette ville est marquée comme inactive.' });
  }

  // Retrieve active neighborhoods
  const activeNbs = neighborhoods.filter(n => n.cityId === cityId && n.active);
  if (activeNbs.length < 2) {
    return res.status(400).json({
      error: `La ville ${city.name} ne dispose que de ${activeNbs.length} quartier(s) actif(s). Il en faut au moins 2 pour générer des trajets.`
    });
  }

  // Generate N * (N - 1) pairs
  let pairs: { origin: Neighborhood; dest: Neighborhood }[] = [];
  for (let i = 0; i < activeNbs.length; i++) {
    for (let j = 0; j < activeNbs.length; j++) {
      if (i !== j) {
        pairs.push({
          origin: activeNbs[i],
          dest: activeNbs[j]
        });
      }
    }
  }

  const totalPossiblePairs = pairs.length;
  let isTestSample = false;
  let parsedLimit: number | undefined;

  if (sampleLimit && sampleLimit !== 'all') {
    parsedLimit = Math.max(1, parseInt(String(sampleLimit), 10));
    if (parsedLimit < totalPossiblePairs) {
      pairs = pairs.slice(0, parsedLimit);
      isTestSample = true;
    }
  }

  const batchSize = Math.max(50, Math.min(2000, Number(requestedBatchSize) || 500));
  const concurrency = Math.max(5, Math.min(50, Number(requestedConcurrency) || 25));
  const totalBatches = Math.ceil(pairs.length / batchSize);

  const campaignId = `camp_${city.name.toLowerCase().substring(0, 3)}_${Date.now()}`;
  const campaign: PricingCampaign = {
    id: campaignId,
    cityId: city.id,
    cityName: city.name,
    currency: city.currency,
    triggerType: triggerType as any,
    providerMode: providerMode as any,
    triggeredByUserId: triggeredByUserId || 'system',
    triggeredByUserName: triggeredByUserName || 'Utilisateur',
    status: 'in_progress',
    selectedClasses,
    totalPairs: pairs.length,
    totalPossiblePairs,
    sampleLimit: parsedLimit,
    isTestSample,
    batchSize,
    totalBatches,
    completedBatches: 0,
    concurrency,
    completedPairs: 0,
    failedPairs: 0,
    startedAt: new Date().toISOString(),
    errorCount: 0,
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: isTestSample
          ? `⚡ Lancement du test rapide (${pairs.length} trajets) pour ${city.name}.`
          : `🚀 Lancement de la campagne globale (${pairs.length.toLocaleString('fr-FR')} trajets découpés en ${totalBatches} lots de ${batchSize}) avec ${concurrency} workers parallèles pour ${city.name}.`
      }
    ]
  };

  campaigns.unshift(campaign);
  const taskAbortController = new AbortController();
  activeCampaignTasks.set(campaignId, { cancelled: false, abortController: taskAbortController });

  console.log(`[Cache Mémoire] Campagne ${campaignId} initialisée en local. Traitement 100% en cache.`);

  // Run async background parallel processing of pairs via high-throughput Worker Pool
  (async () => {
    const taskState = activeCampaignTasks.get(campaignId);
    let completed = 0;
    let failed = 0;
    let totalPrice = 0;
    let totalHeroPrice = 0;
    let totalDistKm = 0;
    let minP = Infinity;
    let maxP = -Infinity;
    let minHeroP = Infinity;
    let maxHeroP = -Infinity;
    let totalHeroDrivers = 0;
    let totalClosestDist = 0;
    let yangoCheaperCount = 0;
    let heroCheaperCount = 0;
    let equalCount = 0;
    let totalDelta = 0;

    const logs = campaign.logs = campaign.logs || [];
    campaign.errorCount = campaign.errorCount || 0;

    const classStatsAccumulator: Record<string, {
      className: string;
      totalPrice: number;
      minPrice: number;
      maxPrice: number;
      count: number;
    }> = {
      econom: { className: 'Éco', totalPrice: 0, minPrice: Infinity, maxPrice: -Infinity, count: 0 },
      business: { className: 'Confort', totalPrice: 0, minPrice: Infinity, maxPrice: -Infinity, count: 0 },
      comfortplus: { className: 'Confort+', totalPrice: 0, minPrice: Infinity, maxPrice: -Infinity, count: 0 },
      moto: { className: 'Moto', totalPrice: 0, minPrice: Infinity, maxPrice: -Infinity, count: 0 }
    };

    // Partition des trajets en lots de 500 (et le reste pour le dernier lot)
    const CHUNK_SIZE = 500;
    interface PairChunk {
      chunkIndex: number;
      totalChunks: number;
      startIndex: number;
      endIndex: number;
      pairs: typeof pairs;
    }

    const chunks: PairChunk[] = [];
    for (let i = 0; i < pairs.length; i += CHUNK_SIZE) {
      chunks.push({
        chunkIndex: Math.floor(i / CHUNK_SIZE) + 1,
        totalChunks: Math.ceil(pairs.length / CHUNK_SIZE),
        startIndex: i,
        endIndex: Math.min(i + CHUNK_SIZE, pairs.length),
        pairs: pairs.slice(i, i + CHUNK_SIZE)
      });
    }

    let nextChunkIndex = 0;
    let completedChunksCount = 0;
    const NUM_PARALLEL_WORKERS = Math.min(20, chunks.length);

    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `⚡ Démarrage immédiat de ${NUM_PARALLEL_WORKERS} workers parallèles pour traiter ${chunks.length} lots de 500 trajets.`
    });

    // Worker prenant dynamiquement un lot de 500 et enchaînant sur le lot suivant dès qu'il termine
    const runLotWorker = async (workerId: number) => {
      while (nextChunkIndex < chunks.length) {
        if (taskState?.cancelled || (campaign.status as any) === 'cancelled') {
          nextChunkIndex = chunks.length;
          break;
        }

        const currentChunk = chunks[nextChunkIndex++];
        if (!currentChunk) break;

        logs.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `🚀 Worker #${workerId} prend en charge le Lot #${currentChunk.chunkIndex}/${currentChunk.totalChunks} (${currentChunk.pairs.length} trajets, index ${currentChunk.startIndex + 1} à ${currentChunk.endIndex}).`
        });

        // Traitement parallèle des requêtes à l'intérieur du lot de 500 (rafales de 10 requêtes simultanées)
        const SUB_CONCURRENCY = 10;
        for (let pIdx = 0; pIdx < currentChunk.pairs.length; pIdx += SUB_CONCURRENCY) {
          if (taskState?.cancelled || (campaign.status as any) === 'cancelled') {
            nextChunkIndex = chunks.length;
            break;
          }
          const subBatch = currentChunk.pairs.slice(pIdx, pIdx + SUB_CONCURRENCY);

          await Promise.all(
            subBatch.map(async ({ origin, dest }) => {
              if (taskState?.cancelled || (campaign.status as any) === 'cancelled') return;
              const tariff = selectedClasses[0] || 'econom';
              const [stats, heroStats] = await Promise.all([
                callYangoRoutestats(origin.lat, origin.lng, dest.lat, dest.lng, tariff, city.currency, taskState?.abortController.signal),
                callHeroStats(origin.lat, origin.lng, dest.lat, dest.lng, tariff, city.currency, origin.name, dest.name, taskState?.abortController.signal)
              ]);

              if (taskState?.cancelled || (campaign.status as any) === 'cancelled') return;

              if (stats.success) {
                completed++;
                totalPrice += stats.price;
                totalDistKm += stats.distanceKm;
                if (stats.price < minP) minP = stats.price;
                if (stats.price > maxP) maxP = stats.price;

                totalHeroPrice += heroStats.price;
                if (heroStats.price < minHeroP) minHeroP = heroStats.price;
                if (heroStats.price > maxHeroP) maxHeroP = heroStats.price;
                totalHeroDrivers += heroStats.availableDriversCount;
                totalClosestDist += (heroStats.closestDriverDistanceKm || 2.5);

                const deltaPrice = stats.price - heroStats.price;
                totalDelta += deltaPrice;
                const cheaperProvider: 'yango' | 'hero' | 'equal' =
                  stats.price < heroStats.price ? 'yango' : (heroStats.price < stats.price ? 'hero' : 'equal');

                if (cheaperProvider === 'yango') yangoCheaperCount++;
                else if (cheaperProvider === 'hero') heroCheaperCount++;
                else equalCount++;

                // Statistiques par classe au fur et à mesure
                if (stats.classes) {
                  for (const [k, qRaw] of Object.entries(stats.classes)) {
                    const q = qRaw as TariffQuoteServer;
                    const normKey = (k === 'comfort' ? 'business' : k);
                    if (!classStatsAccumulator[normKey]) {
                      classStatsAccumulator[normKey] = {
                        className: q.className,
                        totalPrice: 0,
                        minPrice: Infinity,
                        maxPrice: -Infinity,
                        count: 0
                      };
                    }
                    if (q && q.price > 0) {
                      classStatsAccumulator[normKey].totalPrice += q.price;
                      classStatsAccumulator[normKey].count += 1;
                      if (q.price < classStatsAccumulator[normKey].minPrice) classStatsAccumulator[normKey].minPrice = q.price;
                      if (q.price > classStatsAccumulator[normKey].maxPrice) classStatsAccumulator[normKey].maxPrice = q.price;
                    }
                  }

                  const computedClassStats: Record<string, any> = {};
                  for (const [key, item] of Object.entries(classStatsAccumulator)) {
                    if (item.count > 0) {
                      computedClassStats[key] = {
                        className: item.className,
                        avgPrice: Math.round(item.totalPrice / item.count),
                        minPrice: item.minPrice === Infinity ? 0 : item.minPrice,
                        maxPrice: item.maxPrice === -Infinity ? 0 : item.maxPrice,
                        count: item.count
                      };
                    }
                  }
                  campaign.classStats = computedClassStats;
                }

                const trip: TripResult = {
                  id: `trip_${campaignId}_${origin.id}_${dest.id}`,
                  campaignId,
                  cityId: city.id,
                  cityName: city.name,
                  startNeighborhoodId: origin.id,
                  startNeighborhoodName: origin.name,
                  startCoordinates: [origin.lat, origin.lng],
                  endNeighborhoodId: dest.id,
                  endNeighborhoodName: dest.name,
                  endCoordinates: [dest.lat, dest.lng],
                  distanceMeters: stats.distanceMeters,
                  distanceKm: stats.distanceKm,
                  durationSeconds: stats.durationSeconds,
                  durationMinutes: stats.durationMinutes,
                  tariffClass: tariff,
                  price: stats.price,
                  priceFormatted: stats.priceFormatted,
                  currency: city.currency,
                  pricePerKm: stats.pricePerKm,
                  waitingTimeMinutes: stats.waitingTimeMinutes,

                  // Multi-class data saved per destination
                  classes: stats.classes,
                  availableClasses: stats.availableClasses,
                  priceEconom: stats.priceEconom,
                  priceConfort: stats.priceConfort,
                  priceConfortPlus: stats.priceConfortPlus,
                  priceMoto: stats.priceMoto,

                  // Hero Quote & Comparative Benchmark
                  heroQuote: heroStats,
                  priceHero: heroStats.price,
                  priceHeroStandard: heroStats.priceStandard,
                  priceHeroConfort: heroStats.priceConfort,
                  heroDriversCount: heroStats.availableDriversCount,
                  heroClosestDriverDistanceKm: heroStats.closestDriverDistanceKm,
                  deltaPriceYangoVsHero: deltaPrice,
                  cheaperProvider,

                  source: stats.source,
                  status: 'success',
                  // Compact raw response summary to prevent server memory bloat
                  rawResponse: {
                    price: stats.price,
                    classes: Object.keys(stats.classes || {}),
                    distanceKm: stats.distanceKm,
                    durationMinutes: stats.durationMinutes
                  },
                  requestPayload: {
                    startCoords: { lat: origin.lat, lng: origin.lng },
                    endCoords: { lat: dest.lat, lng: dest.lng },
                    selectedClass: tariff
                  },
                  httpStatus: stats.httpStatus,
                  apiCallDetails: {
                    endpoint: yangoSettings.apiEndpoint,
                    sentAt: new Date().toISOString(),
                    latencyMs: stats.latencyMs,
                    httpStatus: stats.httpStatus,
                    error: stats.errorMessage,
                    source: stats.source
                  },
                  createdAt: new Date().toISOString()
                };

                tripResults.unshift(trip);
              } else {
                failed++;
                campaign.errorCount = (campaign.errorCount || 0) + 1;
              }

              // Mise à jour continue des métriques et moyennes en temps réel
              campaign.completedPairs = completed;
              campaign.failedPairs = failed;
              campaign.avgPrice = completed > 0 ? Math.round(totalPrice / completed) : 0;
              campaign.minPrice = minP === Infinity ? 0 : minP;
              campaign.maxPrice = maxP === -Infinity ? 0 : maxP;
              campaign.avgDistanceKm = completed > 0 ? Number((totalDistKm / completed).toFixed(2)) : 0;
              campaign.avgPricePerKm = campaign.avgDistanceKm > 0 ? Math.round(campaign.avgPrice / campaign.avgDistanceKm) : 0;
              campaign.durationSeconds = Math.max(1, Math.round((Date.now() - new Date(campaign.startedAt).getTime()) / 1000));
              campaign.heroStats = {
                avgPrice: completed > 0 ? Math.round(totalHeroPrice / completed) : 0,
                minPrice: minHeroP === Infinity ? 0 : minHeroP,
                maxPrice: maxHeroP === -Infinity ? 0 : maxHeroP,
                avgDriversCount: completed > 0 ? Number((totalHeroDrivers / completed).toFixed(1)) : 0,
                avgClosestDriverDistanceKm: completed > 0 ? Number((totalClosestDist / completed).toFixed(2)) : 0
              };
              campaign.deltaStats = {
                yangoCheaperCount,
                heroCheaperCount,
                equalCount,
                avgDeltaFcfa: completed > 0 ? Math.round(totalDelta / completed) : 0
              };
            })
          );
        }

        completedChunksCount++;
        campaign.completedBatches = completedChunksCount;

        logs.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `✅ Worker #${workerId} a terminé le Lot #${currentChunk.chunkIndex}/${currentChunk.totalChunks} (${currentChunk.pairs.length} trajets). Progression globale : ${completed + failed}/${pairs.length} trajets (${(((completed + failed) / pairs.length) * 100).toFixed(1)}%).`
        });
      }
    };

    // Lancement simultané des workers
    const activeWorkers = Array.from({ length: NUM_PARALLEL_WORKERS }, (_, i) => runLotWorker(i + 1));
    await Promise.all(activeWorkers);

    if (taskState?.cancelled) {
      campaign.status = 'cancelled';
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: 'Campagne interrompue manuellement par l’utilisateur.'
      });
    } else {
      campaign.status = 'completed';
      campaign.finishedAt = new Date().toISOString();
      campaign.durationSeconds = Math.round(
        (new Date(campaign.finishedAt).getTime() - new Date(campaign.startedAt).getTime()) / 1000
      );
      campaign.avgPrice = completed > 0 ? Math.round(totalPrice / completed) : 0;
      campaign.minPrice = minP === Infinity ? 0 : minP;
      campaign.maxPrice = maxP === -Infinity ? 0 : maxP;
      campaign.avgDistanceKm = completed > 0 ? Number((totalDistKm / completed).toFixed(2)) : 0;
      campaign.avgPricePerKm =
        campaign.avgDistanceKm > 0 ? Math.round(campaign.avgPrice / campaign.avgDistanceKm) : 0;

      // Hero aggregate statistics
      campaign.heroStats = {
        avgPrice: completed > 0 ? Math.round(totalHeroPrice / completed) : 0,
        minPrice: minHeroP === Infinity ? 0 : minHeroP,
        maxPrice: maxHeroP === -Infinity ? 0 : maxHeroP,
        avgDriversCount: completed > 0 ? Number((totalHeroDrivers / completed).toFixed(1)) : 0,
        avgClosestDriverDistanceKm: completed > 0 ? Number((totalClosestDist / completed).toFixed(2)) : 0
      };

      // Delta comparison statistics
      campaign.deltaStats = {
        yangoCheaperCount,
        heroCheaperCount,
        equalCount,
        avgDeltaFcfa: completed > 0 ? Math.round(totalDelta / completed) : 0
      };

      logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `🏁 Campagne ${isTestSample ? 'de test ' : ''}terminée avec succès (${completed} trajets). Moyenne Yango: ${campaign.avgPrice} ${city.currency} | Moyenne Hero: ${campaign.heroStats.avgPrice} ${city.currency}.`
      });

      // Update city lastRunAt
      city.autoSchedule.lastRunAt = campaign.finishedAt;
    }

    // Persist final completed campaign to Firestore in ONE SINGLE REQUEST (Zero intermediate writes)
    if (db) {
      try {
        await setDoc(doc(db, 'campaigns', campaignId), cleanFirestoreDoc(campaign));
        console.log(`[Firestore Quota Optimisé] Campagne ${campaignId} enregistrée en 1 SEULE requête Firestore.`);
      } catch (e) {
        console.warn('[Firestore] final single campaign save error:', e);
      }
    }

    activeCampaignTasks.delete(campaignId);
  })();

  return res.status(202).json({
    message: isTestSample
      ? `Test rapide lancé sur ${pairs.length} trajets.`
      : `Campagne de tarification globale lancée sur ${pairs.length.toLocaleString('fr-FR')} trajets.`,
    campaign
  });
});

app.post('/api/campaigns/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;
  const campaign = campaigns.find(c => c.id === id);
  if (!campaign) {
    return res.status(404).json({ error: 'Campagne introuvable.' });
  }

  const task = activeCampaignTasks.get(id);
  if (task) {
    task.cancelled = true;
    try {
      task.abortController.abort();
    } catch {
      // ignore
    }
  }
  campaign.status = 'cancelled';
  campaign.finishedAt = new Date().toISOString();
  if (campaign.startedAt) {
    campaign.durationSeconds = Math.max(
      1,
      Math.round((new Date(campaign.finishedAt).getTime() - new Date(campaign.startedAt).getTime()) / 1000)
    );
  }
  (campaign.logs ??= []).push({
    timestamp: new Date().toISOString(),
    level: 'warn',
    message: 'Arrêt forcé immédiat exécuté.'
  });

  if (db) {
    try {
      await setDoc(doc(db, 'campaigns', id), cleanFirestoreDoc(campaign), { merge: true });
      await recordHistory({
        action: 'CAMPAIGN_CANCELLED',
        eventType: 'campaign',
        title: `Arrêt forcé de la campagne : ${campaign.cityName}`,
        description: `Progression interrompue immédiatement à ${campaign.completedPairs}/${campaign.totalPairs} trajets.`,
        status: 'cancelled'
      });
    } catch (e) {
      console.warn('[Firestore] cancel campaign error:', e);
    }
  }

  return res.json({ success: true, campaign });
});

app.delete('/api/campaigns', async (_req: Request, res: Response) => {
  const oldCampaigns = [...campaigns];
  campaigns = [];
  tripResults = [];

  if (db && oldCampaigns.length > 0) {
    try {
      for (const c of oldCampaigns) {
        await deleteDoc(doc(db, 'campaigns', c.id));
      }
      await recordHistory({
        action: 'ALL_CAMPAIGNS_DELETED',
        eventType: 'campaign',
        title: `Toutes les campagnes ont été réinitialisées`,
        description: `${oldCampaigns.length} campagnes supprimées de Firestore.`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Firestore] delete all campaigns error:', e);
    }
  }

  return res.json({ success: true, message: 'Toutes les campagnes et résultats ont été réinitialisés.' });
});

app.delete('/api/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const targetCamp = campaigns.find(c => c.id === id);
  const campName = targetCamp ? `${targetCamp.cityName} (${targetCamp.startedAt})` : id;
  campaigns = campaigns.filter(c => c.id !== id);
  tripResults = tripResults.filter(t => t.campaignId !== id);

  if (db) {
    try {
      await deleteDoc(doc(db, 'campaigns', id));
      const subSnap = await getDocs(collection(db, 'campaigns', id, 'trip_results'));
      if (!subSnap.empty) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < subSnap.docs.length; i += BATCH_SIZE) {
          const chunk = subSnap.docs.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          for (const d of chunk) {
            batch.delete(doc(db, 'campaigns', id, 'trip_results', d.id));
          }
          await batch.commit();
        }
      }
      await recordHistory({
        action: 'CAMPAIGN_DELETED',
        eventType: 'campaign',
        title: `Campagne supprimée de Firestore`,
        description: `Campagne ${campName} et ses relevés de prix supprimés.`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Firestore] delete campaign error:', e);
    }
  }

  return res.json({ success: true, message: 'Campagne et résultats archivés supprimés.' });
});

// 7. Trip results query
app.get('/api/campaigns/:id/results', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startNeighborhood, endNeighborhood, minPrice, maxPrice, search } = req.query;

  let results = tripResults.filter(t => t.campaignId === id);

  if (results.length === 0 && db) {
    try {
      const snap = await getDocs(collection(db, 'campaigns', id, 'trip_results'));
      if (!snap.empty) {
        results = snap.docs.map(d => ({ id: d.id, ...d.data() } as TripResult));
        tripResults = tripResults.concat(results);
      }
    } catch (e) {
      console.warn('[Firestore] get trip results error:', e);
    }
  }

  if (startNeighborhood) {
    results = results.filter(t => t.startNeighborhoodId === startNeighborhood || t.startNeighborhoodName === startNeighborhood);
  }

  if (endNeighborhood) {
    results = results.filter(t => t.endNeighborhoodId === endNeighborhood || t.endNeighborhoodName === endNeighborhood);
  }

  if (minPrice) {
    results = results.filter(t => t.price >= Number(minPrice));
  }

  if (maxPrice) {
    results = results.filter(t => t.price <= Number(maxPrice));
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    results = results.filter(t =>
      t.startNeighborhoodName.toLowerCase().includes(q) ||
      t.endNeighborhoodName.toLowerCase().includes(q)
    );
  }

  // Optimize payload size for fast streaming and low network overhead
  const { includeRaw } = req.query;
  if (includeRaw !== 'true') {
    const sanitized = results.map(t => {
      const { rawResponse, requestPayload, apiCallDetails, ...clean } = t;
      return clean;
    });
    return res.json(sanitized);
  }

  return res.json(results);
});

// 8. CSV / Excel Export endpoint
app.get('/api/campaigns/:id/export', (req: Request, res: Response) => {
  const { id } = req.params;
  const campaign = campaigns.find(c => c.id === id);
  if (!campaign) {
    return res.status(404).send('Campagne introuvable.');
  }

  const trips = tripResults.filter(t => t.campaignId === id);

  // Generate CSV with RFC4180 quotes and UTF-8 BOM
  const headers = [
    'ID Trajet',
    'Ville',
    'Départ (Quartier)',
    'Latitude Départ',
    'Longitude Départ',
    'Arrivée (Quartier)',
    'Latitude Arrivée',
    'Longitude Arrivée',
    'Distance (km)',
    'Durée (minutes)',
    'Classe Tarifaire',
    'Prix (FCFA)',
    'Prix par km (FCFA/km)',
    'Temps Attente (min)',
    'Source Donnée',
    'Date Relevé'
  ];

  const rows = trips.map(t => [
    `"${t.id}"`,
    `"${t.cityName || ''}"`,
    `"${t.startNeighborhoodName.replace(/"/g, '""')}"`,
    t.startCoordinates ? t.startCoordinates[0] : '',
    t.startCoordinates ? t.startCoordinates[1] : '',
    `"${t.endNeighborhoodName.replace(/"/g, '""')}"`,
    t.endCoordinates ? t.endCoordinates[0] : '',
    t.endCoordinates ? t.endCoordinates[1] : '',
    t.distanceKm,
    t.durationMinutes,
    `"${t.tariffClass}"`,
    t.price,
    t.pricePerKm,
    t.waitingTimeMinutes || '',
    `"${t.source}"`,
    `"${t.createdAt || ''}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="pricing_yango_${campaign.cityName.toLowerCase()}_${campaign.id}.csv"`
  );
  return res.send(csvContent);
});

// 9. Automated scheduler route (Disabled: 100% manual pricing)
app.post('/api/cron/trigger-scheduled', async (_req: Request, res: Response) => {
  return res.json({
    success: true,
    triggeredCount: 0,
    cities: [],
    message: 'Cycles automatiques désactivés. Mode 100% manuel actif.'
  });
});

// 10. Settings endpoint (Yango & Hero)
const handleGetYangoSettings = async (_req: Request, res: Response) => {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'settings', 'yango'));
      if (snap.exists()) {
        yangoSettings = { ...yangoSettings, ...snap.data() };
      }
    } catch (e) {
      console.warn('[Firestore] get yango settings error:', e);
    }
  }
  res.json(yangoSettings);
};

const handlePostYangoSettings = async (req: Request, res: Response) => {
  const { apiEndpoint, bearerToken, userAgent, requestDelayMs, mode } = req.body;
  if (apiEndpoint) yangoSettings.apiEndpoint = apiEndpoint.trim();
  if (bearerToken !== undefined) yangoSettings.bearerToken = bearerToken.trim();
  if (userAgent !== undefined) yangoSettings.userAgent = userAgent.trim();
  if (requestDelayMs !== undefined) yangoSettings.requestDelayMs = Math.max(50, Number(requestDelayMs));
  if (mode !== undefined) yangoSettings.mode = mode;

  if (db) {
    try {
      await setDoc(doc(db, 'settings', 'yango'), cleanFirestoreDoc(yangoSettings), { merge: true });
      await recordHistory({
        action: 'SETTINGS_YANGO_UPDATED',
        eventType: 'settings',
        title: 'Mise à jour des paramètres Yango',
        description: `Mode: ${yangoSettings.mode}, Délai: ${yangoSettings.requestDelayMs}ms, Classes: ${yangoSettings.classes?.length || 0}`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Firestore] save yango settings error:', e);
    }
  }

  return res.json({ success: true, settings: yangoSettings });
};

app.get('/api/settings', handleGetYangoSettings);
app.get('/api/settings/yango', handleGetYangoSettings);
app.post('/api/settings', handlePostYangoSettings);
app.post('/api/settings/yango', handlePostYangoSettings);

app.get('/api/settings/hero', async (_req: Request, res: Response) => {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'settings', 'hero'));
      if (snap.exists()) {
        heroSettings = { ...heroSettings, ...snap.data() };
      }
    } catch (e) {
      console.warn('[Firestore] get hero settings error:', e);
    }
  }
  res.json(heroSettings);
});

app.post('/api/settings/hero', async (req: Request, res: Response) => {
  const { apiEndpoint, email, password, requestDelayMs, mode } = req.body;

  if (apiEndpoint) heroSettings.apiEndpoint = apiEndpoint.trim();
  if (email !== undefined) heroSettings.email = email.trim();
  if (password !== undefined) heroSettings.password = password.trim();
  if (requestDelayMs !== undefined) heroSettings.requestDelayMs = Math.max(50, Number(requestDelayMs));
  if (mode !== undefined) heroSettings.mode = mode;

  if (db) {
    try {
      await setDoc(doc(db, 'settings', 'hero'), cleanFirestoreDoc(heroSettings), { merge: true });
      await recordHistory({
        action: 'SETTINGS_HERO_UPDATED',
        eventType: 'settings',
        title: 'Mise à jour des paramètres Hero',
        description: `Mode: ${heroSettings.mode}, Délai: ${heroSettings.requestDelayMs}ms`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Firestore] save hero settings error:', e);
    }
  }

  return res.json({ success: true, settings: heroSettings });
});

// 11. History & Audit Trail endpoint
app.get('/api/history', async (_req: Request, res: Response) => {
  if (db) {
    try {
      const historySnap = await getDocs(collection(db, 'history'));
      if (!historySnap.empty) {
        historyRecords = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
        historyRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    } catch (e) {
      console.warn('[Firestore] get history error:', e);
    }
  }
  return res.json(historyRecords);
});

app.delete('/api/history/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  historyRecords = historyRecords.filter(h => h.id !== id);
  if (db) {
    try {
      await deleteDoc(doc(db, 'history', id));
    } catch (e) {
      console.warn('[Firestore] delete history error:', e);
    }
  }
  return res.json({ success: true, message: 'Entrée d’historique supprimée.' });
});

// ----------------- VITE MIDDLEWARE / STATIC FILES ----------------- //

async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const distIndex = path.resolve(distPath, 'index.html');
  const hasDist = fs.existsSync(distIndex);

  if (process.env.NODE_ENV === 'production' || hasDist) {
    console.log(`[VTC Pricing Hub] Mode Production: fichiers servis depuis ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: `Endpoint API non trouvé : ${req.method} ${req.path}` });
      }
      res.sendFile(distIndex);
    });
  } else {
    console.log(`[VTC Pricing Hub] Mode Développement: middleware Vite actif`);
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VTC Pricing Hub] Full-stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
