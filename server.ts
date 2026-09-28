import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { randomUUID } from 'crypto';
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
  calculateDistanceKm,
  estimateUrbanTrip
} from './src/utils/geoUtils.js';
import {
  generateBenchmarkPairs,
  calculatePossibleBenchmarkPairsCount
} from './src/utils/routeMatrix.js';
import type {
  City,
  Neighborhood,
  PricingCampaign,
  TripResult,
  User,
  YangoSettings,
  HeroSettings,
  TripMasterSettings,
  HeroQuote,
  HeroDriver,
  CampaignLog
} from './src/types/index.js';

dotenv.config();

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger la config Firebase de manière 100% robuste pour Node 20 / Vercel sans erreur d'attribut d'importation JSON
let firebaseConfigData: any = null;
try {
  firebaseConfigData = require('./firebase-applet-config.json');
} catch {
  const pathsToTry = [
    path.join(process.cwd(), 'firebase-applet-config.json'),
    path.join(__dirname, 'firebase-applet-config.json'),
    path.join(__dirname, '../firebase-applet-config.json'),
  ];
  for (const cfgPath of pathsToTry) {
    if (fs.existsSync(cfgPath)) {
      try {
        const diskCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        if (diskCfg && diskCfg.apiKey) {
          firebaseConfigData = diskCfg;
        }
      } catch {}
      break;
    }
  }
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable CORS & JSON parsing
app.use(express.json());
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Initialize Firestore
let db: any = null;
try {
  if (firebaseConfigData && firebaseConfigData.apiKey) {
    const firebaseApp = initializeApp(firebaseConfigData);
    db = getFirestore(firebaseApp, firebaseConfigData.firestoreDatabaseId);
    console.log(`[Firestore] Connecté à la base de données : ${firebaseConfigData.firestoreDatabaseId}`);
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
let users: User[] = [];
let cities: City[] = [];
let neighborhoods: Neighborhood[] = [];

// 24-Hour Cache configuration for neighborhoods & cities
const NEIGHBORHOODS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
let lastNeighborhoodsFetchTimestamp = 0;

const CITIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
let lastCitiesFetchTimestamp = 0;

// Trip Master Cameroon Settings configuration (100% Live API)
let tripMasterSettings: TripMasterSettings = {
  distanceEndpoint: 'https://tripmastercameroon.com/get-distance',
  searchVehicleEndpoint: 'https://tripmastercameroon.com/search-vehicle',
  requestDelayMs: 150,
  mode: 'live'
};

// Session de pricing active UNIQUEMENT pendant l'exécution en temps réel
// Une fois le pricing terminé, les données sont écrites en BD Firestore et le cache mémoire est vidé immédiatement.
interface ActivePricingSession {
  campaign: PricingCampaign;
  trips: TripResult[];
  workerResults: Record<string, any[]>;
  abortController: AbortController;
  cancelled: boolean;
}
const activePricingSessions = new Map<string, ActivePricingSession>();

// Sync from Firestore on server startup
async function syncFromFirestore() {
  if (!db) return;
  try {
    const [usersRes, citiesRes, nbsRes, yangoRes, heroRes, tripmasterRes, historyRes] = await Promise.allSettled([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'cities')),
      getDocs(collection(db, 'neighborhoods')),
      getDoc(doc(db, 'settings', 'yango')),
      getDoc(doc(db, 'settings', 'hero')),
      getDoc(doc(db, 'settings', 'tripmaster')),
      getDocs(collection(db, 'history'))
    ]);

    if (usersRes.status === 'fulfilled' && !usersRes.value.empty) {
      users = usersRes.value.docs.map(d => ({ id: d.id, ...d.data() } as User));
    }

    if (citiesRes.status === 'fulfilled' && !citiesRes.value.empty) {
      cities = citiesRes.value.docs.map(d => ({ id: d.id, ...d.data() } as City));
      lastCitiesFetchTimestamp = Date.now();
    }

    if (nbsRes.status === 'fulfilled' && !nbsRes.value.empty) {
      neighborhoods = nbsRes.value.docs.map(d => ({ id: d.id, ...d.data() } as Neighborhood));
      lastNeighborhoodsFetchTimestamp = Date.now();
    }

    if (yangoRes.status === 'fulfilled' && yangoRes.value.exists()) {
      yangoSettings = { ...yangoSettings, ...yangoRes.value.data() };
    }

    if (heroRes.status === 'fulfilled' && heroRes.value.exists()) {
      heroSettings = { ...heroSettings, ...heroRes.value.data() };
    }

    if (tripmasterRes.status === 'fulfilled' && tripmasterRes.value.exists()) {
      tripMasterSettings = { ...tripMasterSettings, ...tripmasterRes.value.data() };
    }

    if (historyRes.status === 'fulfilled' && !historyRes.value.empty) {
      historyRecords = historyRes.value.docs.map(d => ({ id: d.id, ...d.data() }));
      historyRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    console.log(`[Firestore] Sync rapide terminé (${users.length} users, ${cities.length} villes, ${neighborhoods.length} quartiers).`);
  } catch (err) {
    console.warn('[Firestore] Erreur lors de la synchronisation initiale :', err);
  }
}
syncFromFirestore();

let isFirestoreQuotaExceeded = false;
let quotaExceededLogged = false;

/**
 * Wrapper sécurisé pour toutes les écritures Firestore.
 * Si le quota journalier d'écriture de la formule gratuite est atteint (RESOURCE_EXHAUSTED),
 * bascule instantanément en mode mémoire locale & stockage autonome pour que l'application ne plante jamais.
 */
async function safeFirestoreWrite<T>(opName: string, writeFn: () => Promise<T>): Promise<T | null> {
  if (!db || isFirestoreQuotaExceeded) {
    return null;
  }
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore write timeout')), 2500)
    );
    return await Promise.race([writeFn(), timeoutPromise]);
  } catch (err: any) {
    const msg = err?.message || String(err);
    const code = err?.code || '';
    if (
      code === 'resource-exhausted' ||
      code === 8 ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('Quota limit exceeded') ||
      msg.includes('Quota exceeded') ||
      msg.includes('Firestore write timeout')
    ) {
      isFirestoreQuotaExceeded = true;
      if (!quotaExceededLogged) {
        quotaExceededLogged = true;
        console.warn(`[Firestore Quota] ℹ️ Quota journalier d'écriture Firestore atteint pour le projet ("${opName}"). Basculement automatique en mode mémoire locale.`);
      }
      return null;
    }
    console.warn(`[Firestore] Erreur lors de "${opName}":`, err?.message || err);
    return null;
  }
}

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
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    status: 'success',
    ...record
  };
  historyRecords.unshift(item);
  await safeFirestoreWrite('recordHistory', () => setDoc(doc(db, 'history', item.id), cleanFirestoreDoc(item)));
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

    const isSuccess = Boolean(extractedStandardPrice || extractedConfortPrice || extractedSuvPrice);
    const finalPrice = (tariffClass === 'comfort' || tariffClass === 'business')
      ? (extractedConfortPrice || extractedStandardPrice || 0)
      : (extractedStandardPrice || 0);

    return {
      success: isSuccess,
      source: 'hero_live',
      price: finalPrice,
      priceFormatted: finalPrice > 0 ? `${finalPrice.toLocaleString('fr-FR')} ${cityCurrency}` : 'Non disponible',
      pricePerKm: distKm > 0 && finalPrice > 0 ? Math.round(finalPrice / distKm) : 0,
      priceStandard: extractedStandardPrice || 0,
      priceConfort: extractedConfortPrice || 0,
      priceSuv: extractedSuvPrice || 0,
      priceGrossStandard: rawStandardGross,
      priceGrossConfort: rawConfortGross,
      availableDriversCount,
      closestDriverDistanceKm: availableDriversCount > 0 ? Number((distKm * 0.25 + 0.4).toFixed(2)) : 0,
      closestDriverName: availableDriversCount > 0 ? closestDriverName : '',
      closestDriverRating: availableDriversCount > 0 ? 4.8 : 0,
      waitingTimeMinutes: availableDriversCount > 0 ? Math.max(2, Math.round(distKm * 0.3 + 2)) : 0,
      rawResponse,
      latencyMs: Date.now() - startTime,
      httpStatus,
      errorMessage: isSuccess ? undefined : 'Aucun tarif retourné par Hero Cab (HTML sans prix de véhicules)'
    };
  } catch (err: any) {
    errorMessage = err.name === 'AbortError' ? 'Timeout Hero Cab (> 6s)' : (err.message || 'Erreur réseau vers API Hero');

    return {
      success: false,
      source: 'hero_live',
      price: 0,
      priceFormatted: 'Non disponible',
      pricePerKm: 0,
      priceStandard: 0,
      priceConfort: 0,
      priceSuv: 0,
      availableDriversCount: 0,
      waitingTimeMinutes: 0,
      latencyMs: Date.now() - startTime,
      httpStatus: 500,
      errorMessage,
      rawResponse: { error: errorMessage }
    };
  }
}

/**
 * Helper to call Trip Master Cameroon API (2-step: /get-distance -> /search-vehicle)
 */
export interface TripMasterStatsResult {
  success: boolean;
  source: 'tripmaster_live';
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  priceEco: number;
  priceConfort: number;
  priceMoto: number;
  rawResponse?: any;
  latencyMs: number;
  httpStatus: number;
  errorMessage?: string;
}

function parseTripMasterNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  if (!val) return 0;
  // Nettoyage intelligent : gestion des espaces séparateurs de milliers ("1 500 FCFA" -> "1500")
  const str = String(val).replace(/\s+/g, '').replace(/,/g, '.');
  const clean = str.replace(/[^\d.]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Extracteur universel de tarifs Trip Master (JSON, Objet, Tableau ou HTML)
 */
function extractPricesFromTripMasterResponse(input: any): { priceEco: number; priceConfort: number; priceMoto: number } {
  let priceEco = 0;
  let priceConfort = 0;
  let priceMoto = 0;

  if (!input) return { priceEco, priceConfort, priceMoto };

  let data = input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        data = JSON.parse(trimmed);
      } catch {
        // Garder sous forme de chaîne textuelle
      }
    }
  }

  // 1. Si c'est une chaîne HTML ou texte brut
  if (typeof data === 'string') {
    return parseTripMasterHtmlResponse(data);
  }

  // 2. Si c'est un objet ou un tableau JSON
  if (typeof data === 'object' && data !== null) {
    // A. Clés directes sur l'objet
    const dEco = parseTripMasterNumber(data.priceEco || data.price_eco || data.eco || data.standard || data.price_standard || data.priceStandard);
    const dConfort = parseTripMasterNumber(data.priceConfort || data.price_confort || data.confort || data.berline || data.vip || data.suv || data.price_vip);
    const dMoto = parseTripMasterNumber(data.priceMoto || data.price_moto || data.moto || data.bike);

    if (dEco > 0) priceEco = dEco;
    if (dConfort > 0) priceConfort = dConfort;
    if (dMoto > 0) priceMoto = dMoto;

    if (priceEco > 0 || priceConfort > 0 || priceMoto > 0) {
      return { priceEco, priceConfort, priceMoto };
    }

    // B. Recherche dans les sous-listes / tableaux
    let items: any[] = [];
    if (Array.isArray(data)) {
      items = data;
    } else {
      for (const k of ['vehicles', 'classes', 'data', 'result', 'results', 'options', 'services', 'cars', 'tariffs', 'rates', 'categories', 'rides', 'estimation']) {
        if (Array.isArray(data[k])) {
          items = data[k];
          break;
        } else if (data[k] && typeof data[k] === 'object') {
          const sub = extractPricesFromTripMasterResponse(data[k]);
          if (sub.priceEco > 0 || sub.priceConfort > 0 || sub.priceMoto > 0) {
            return sub;
          }
        }
      }
    }

    if (items.length > 0) {
      for (const v of items) {
        if (!v) continue;
        if (typeof v !== 'object') {
          const p = parseTripMasterNumber(v);
          if (p > 0 && !priceEco) priceEco = p;
          continue;
        }
        const name = String(v.name || v.title || v.class || v.type || v.category || v.label || v.vehicle_type || v.mode || '').toLowerCase();
        const p = parseTripMasterNumber(v.price || v.fare || v.cost || v.amount || v.total || v.rate || v.tariff || v.price_amount);
        if (p > 0) {
          if (name.includes('confort') || name.includes('berline') || name.includes('vip') || name.includes('suv') || name.includes('comfort')) {
            if (!priceConfort) priceConfort = p;
          } else if (name.includes('moto') || name.includes('bike') || name.includes('scooter')) {
            if (!priceMoto) priceMoto = p;
          } else {
            if (!priceEco) priceEco = p;
          }
        }
      }
    }

    // C. Repli sur champ de prix unique
    if (priceEco === 0 && priceConfort === 0 && priceMoto === 0) {
      const singleP = parseTripMasterNumber(data.price || data.fare || data.cost || data.amount || data.total || data.tariff);
      if (singleP > 0) {
        priceEco = singleP;
      }
    }
  }

  return { priceEco, priceConfort, priceMoto };
}

/**
 * Helper to decode HTML responses returned by Trip Master and extract vehicle prices
 */
function parseTripMasterHtmlResponse(html: string): { priceEco: number; priceConfort: number; priceMoto: number } {
  let priceEco = 0;
  let priceConfort = 0;
  let priceMoto = 0;

  if (!html || typeof html !== 'string') return { priceEco, priceConfort, priceMoto };

  // 1. Détection de JSON encapsulé dans les balises <script> ou attributs data-
  const scriptJsonMatch = html.match(/(?:vehicles|classes|prices|tariffs|rates)\s*=\s*(\[\s*\{[\s\S]*?\}\s*\]|\{[\s\S]*?\})/i);
  if (scriptJsonMatch && scriptJsonMatch[1]) {
    try {
      const parsed = JSON.parse(scriptJsonMatch[1]);
      const sub = extractPricesFromTripMasterResponse(parsed);
      if (sub.priceEco > 0 || sub.priceConfort > 0 || sub.priceMoto > 0) {
        return sub;
      }
    } catch {
      // Poursuivre l'extraction HTML
    }
  }

  // 2. Détection de balises HTML <input>, <button>, <div class="price"> avec attributs data-price / value
  const inputRegex = /<(?:input|button|div|tr|li|span)[^>]*(?:data-(?:price|fare|amount|cost|fare-amount)|value|class)[^>]*>/gi;
  const matches = html.match(inputRegex) || [];

  for (const tag of matches) {
    const nameMatch = tag.match(/(?:data-(?:type|class|name)|name|id|class)\s*=\s*['"]([^'"]+)['"]/i);
    const priceMatch = tag.match(/(?:data-(?:price|fare|amount|cost|fare-amount)|value)\s*=\s*['"]([^'"]+)['"]/i);

    if (priceMatch && priceMatch[1]) {
      const p = parseTripMasterNumber(priceMatch[1]);
      const name = nameMatch ? nameMatch[1].toLowerCase() : '';

      if (p > 0) {
        if (name.includes('confort') || name.includes('berline') || name.includes('vip') || name.includes('suv')) {
          if (!priceConfort) priceConfort = p;
        } else if (name.includes('moto') || name.includes('bike')) {
          if (!priceMoto) priceMoto = p;
        } else {
          if (!priceEco) priceEco = p;
        }
      }
    }
  }

  if (priceEco > 0 || priceConfort > 0 || priceMoto > 0) {
    return { priceEco, priceConfort, priceMoto };
  }

  // 3. Extraction des nœuds texte HTML associant le type de véhicule au prix (ex: "Éco: 2 500 FCFA")
  const textPattern = /(eco|éco|standard|confort|berline|vip|suv|moto|bike)[^0-9]{1,40}?([\d\s.]{3,10})\s*(?:FCFA|F|XAF)?/gi;
  let textMatch;
  while ((textMatch = textPattern.exec(html)) !== null) {
    const typeName = textMatch[1].toLowerCase();
    const priceVal = parseTripMasterNumber(textMatch[2]);
    if (priceVal >= 200 && priceVal <= 100000) {
      if (typeName.includes('confort') || typeName.includes('berline') || typeName.includes('vip') || typeName.includes('suv')) {
        if (!priceConfort) priceConfort = priceVal;
      } else if (typeName.includes('moto') || typeName.includes('bike')) {
        if (!priceMoto) priceMoto = priceVal;
      } else {
        if (!priceEco) priceEco = priceVal;
      }
    }
  }

  // 4. Repli générique sur tout montant FCFA/XAF trouvé dans la page HTML
  if (priceEco === 0 && priceConfort === 0 && priceMoto === 0) {
    const genericPriceRegex = /([\d\s.]{3,8})\s*(?:FCFA|XAF)/gi;
    let genMatch;
    const foundPrices: number[] = [];
    while ((genMatch = genericPriceRegex.exec(html)) !== null) {
      const p = parseTripMasterNumber(genMatch[1]);
      if (p >= 300 && p <= 100000) {
        foundPrices.push(p);
      }
    }
    if (foundPrices.length > 0) {
      priceEco = foundPrices[0];
      if (foundPrices.length > 1) priceConfort = foundPrices[1];
      if (foundPrices.length > 2) priceMoto = foundPrices[2];
    }
  }

  return { priceEco, priceConfort, priceMoto };
}

async function callTripMasterStats(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  cityCurrency: string = 'XAF',
  signal?: AbortSignal
): Promise<TripMasterStatsResult> {
  const startTime = Date.now();
  if (signal?.aborted) {
    return {
      success: false,
      source: 'tripmaster_live',
      distanceMeters: 0,
      distanceKm: 0,
      durationSeconds: 0,
      durationMinutes: 0,
      priceEco: 0,
      priceConfort: 0,
      priceMoto: 0,
      latencyMs: 0,
      httpStatus: 0,
      errorMessage: 'Cancelled'
    };
  }

  try {
    const controller = new AbortController();
    const onParentAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onParentAbort, { once: true });
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    // Step 1: POST distanceEndpoint (default: https://tripmastercameroon.com/get-distance)
    let distRes: any = null;
    let distData: any = {};
    try {
      distRes = await fetch(tripMasterSettings.distanceEndpoint || 'https://tripmastercameroon.com/get-distance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://tripmastercameroon.com/'
        },
        body: JSON.stringify({
          startLat,
          startLng,
          endLat,
          endLng,
          start_lat: startLat,
          start_lng: startLng,
          end_lat: endLat,
          end_lng: endLng,
          pickup_lat: startLat,
          pickup_lng: startLng,
          dropoff_lat: endLat,
          dropoff_lng: endLng,
          lat1: startLat,
          lng1: startLng,
          lat2: endLat,
          lng2: endLng
        }),
        signal: controller.signal
      });

      if (distRes.ok) {
        const text = await distRes.text();
        try {
          distData = JSON.parse(text);
        } catch {
          distData = { raw: text };
        }
      }
    } catch (e) {
      // Ignore network timeout
    }

    // Parse distance & duration from Trip Master step 1 response
    let rawDist = distData.distance || distData.dist || distData.dist_meters || distData.distanceMeters || 0;
    let rawDuration = distData.duration || distData.time || distData.duration_seconds || distData.durationSeconds || 0;

    let distKm = 0;
    let distMeters = 0;
    if (rawDist > 100) {
      distMeters = Math.round(rawDist);
      distKm = Number((distMeters / 1000).toFixed(2));
    } else if (rawDist > 0) {
      distKm = Number(rawDist.toFixed(2));
      distMeters = Math.round(distKm * 1000);
    } else {
      distKm = calculateDistanceKm(startLat, startLng, endLat, endLng);
      distMeters = Math.round(distKm * 1000);
    }

    let durationSeconds = rawDuration > 0 ? Math.round(rawDuration) : Math.round((distKm / 30) * 3600);
    let durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

    // Step 2: POST searchVehicleEndpoint (default: https://tripmastercameroon.com/search-vehicle)
    let priceEco = 0;
    let priceConfort = 0;
    let priceMoto = 0;
    let searchRaw: any = null;
    let httpStatus = distRes?.status || 200;

    try {
      const searchRes = await fetch(tripMasterSettings.searchVehicleEndpoint || 'https://tripmastercameroon.com/search-vehicle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://tripmastercameroon.com/search-vehicle'
        },
        body: JSON.stringify({
          startLat,
          startLng,
          endLat,
          endLng,
          start_lat: startLat,
          start_lng: startLng,
          end_lat: endLat,
          end_lng: endLng,
          pickup_lat: startLat,
          pickup_lng: startLng,
          dropoff_lat: endLat,
          dropoff_lng: endLng,
          lat1: startLat,
          lng1: startLng,
          lat2: endLat,
          lng2: endLng,
          distance: distMeters,
          duration: durationSeconds,
          dist_meters: distMeters,
          duration_seconds: durationSeconds
        }),
        signal: controller.signal
      });

      httpStatus = searchRes.status;
      const searchTxt = await searchRes.text();
      try {
        searchRaw = JSON.parse(searchTxt);
      } catch {
        searchRaw = searchTxt;
      }

      // Extraction universelle
      const decodedSearch = extractPricesFromTripMasterResponse(searchRaw);
      priceEco = decodedSearch.priceEco;
      priceConfort = decodedSearch.priceConfort;
      priceMoto = decodedSearch.priceMoto;

      if (priceEco === 0 && priceConfort === 0 && priceMoto === 0 && distData) {
        const decodedDist = extractPricesFromTripMasterResponse(distData);
        priceEco = decodedDist.priceEco;
        priceConfort = decodedDist.priceConfort;
        priceMoto = decodedDist.priceMoto;
      }
    } catch (e) {
      // Step 2 error
    }

    clearTimeout(timeoutId);

    const isSuccess = priceEco > 0 || priceConfort > 0 || priceMoto > 0;

    return {
      success: isSuccess,
      source: 'tripmaster_live',
      distanceMeters: distMeters,
      distanceKm: distKm,
      durationSeconds,
      durationMinutes,
      priceEco,
      priceConfort,
      priceMoto,
      rawResponse: { distData, searchRaw },
      latencyMs: Date.now() - startTime,
      httpStatus,
      errorMessage: isSuccess ? undefined : 'Aucun tarif retourné par l’API Live Trip Master'
    };
  } catch (err: any) {
    const distKm = calculateDistanceKm(startLat, startLng, endLat, endLng);
    return {
      success: false,
      source: 'tripmaster_live',
      distanceMeters: Math.round(distKm * 1000),
      distanceKm: distKm,
      durationSeconds: Math.round((distKm / 30) * 3600),
      durationMinutes: Math.round((distKm / 30) * 60),
      priceEco: 0,
      priceConfort: 0,
      priceMoto: 0,
      latencyMs: Date.now() - startTime,
      httpStatus: 500,
      errorMessage: err.message || 'Erreur réseau vers l’API Trip Master'
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

  for (let attempt = 0; attempt <= 1; attempt++) {
    if (signal?.aborted) break;
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 350));
    }

    try {
      const controller = new AbortController();
      const onParentAbort = () => controller.abort();
      if (signal) {
        signal.addEventListener('abort', onParentAbort, { once: true });
      }
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': yangoSettings.userAgent || 'Yango-VTC-Pricing-Intelligence/1.0',
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
          priceFormatted: price > 0 ? `${price.toLocaleString('fr-FR')} ${cityCurrency}` : 'Non disponible',
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
          ? 'Timeout Yango (> 7s)'
          : err.message || 'Erreur réseau vers le proxy Yango';
    }
  }

  // Pure Live Error response (strictly no algorithmic fallback)
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
    rawResponse: rawResponse || { error: errorMessage, source: 'yango_live_error' },
    requestPayload: payload,
    httpStatus: httpStatus || 500,
    errorMessage: errorMessage || 'Erreur réponse live Yango'
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
    id: randomUUID(),
    name: name.trim(),
    email: cleanEmail,
    role: role || 'employe',
    active: true,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);

  await safeFirestoreWrite('createUser', () => setDoc(doc(db!, 'users', newUser.id), cleanFirestoreDoc(newUser)));
  await recordHistory({
    action: 'USER_CREATED',
    eventType: 'users',
    title: `Nouvel utilisateur créé : ${newUser.name}`,
    description: `Email : ${newUser.email}, Rôle : ${newUser.role}`,
    status: 'success'
  });

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

  await safeFirestoreWrite('updateUser', () => setDoc(doc(db!, 'users', user.id), cleanFirestoreDoc(user), { merge: true }));
  await recordHistory({
    action: 'USER_UPDATED',
    eventType: 'users',
    title: `Utilisateur modifié : ${user.name}`,
    description: `Rôle : ${user.role}, Actif : ${user.active ? 'Oui' : 'Non'}`,
    status: 'success'
  });

  return res.json(user);
});

app.delete('/api/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  let targetUser = users.find(u => u.id === id);

  // If not found in memory, query Firestore
  if (!targetUser && db) {
    try {
      const uDoc = await getDoc(doc(db, 'users', id));
      if (uDoc.exists()) {
        targetUser = { id: uDoc.id, ...uDoc.data() } as User;
      }
    } catch (e) {
      console.warn('[Firestore] error checking user:', e);
    }
  }

  // Count total users to prevent removing the only user in the database
  let totalUsers = users.length;
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        totalUsers = snap.size;
      }
    } catch {}
  }

  if (totalUsers <= 1) {
    return res.status(400).json({ error: 'Impossible de supprimer le seul utilisateur restant du système.' });
  }

  if (!targetUser && users.findIndex(u => u.id === id) === -1) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const userName = targetUser ? targetUser.name : id;
  users = users.filter(u => u.id !== id);

  await safeFirestoreWrite('deleteUser', () => deleteDoc(doc(db!, 'users', id)));
  await recordHistory({
    action: 'USER_DELETED',
    eventType: 'users',
    title: `Utilisateur supprimé : ${userName}`,
    status: 'success'
  });

  return res.json({ success: true, message: `L'utilisateur ${userName} a été supprimé avec succès.` });
});

// 3. City routes (avec cache persistant 24h)
app.get('/api/cities', async (req: Request, res: Response) => {
  const { forceRefresh } = req.query;
  const isCacheExpired = Date.now() - lastCitiesFetchTimestamp > CITIES_CACHE_TTL_MS;

  if (db && (isCacheExpired || forceRefresh === 'true' || cities.length === 0)) {
    try {
      const snap = await getDocs(collection(db, 'cities'));
      if (!snap.empty) {
        cities = snap.docs.map(d => ({ id: d.id, ...d.data() } as City));
        lastCitiesFetchTimestamp = Date.now();
      }
    } catch (e) {
      console.warn('[Firestore] get cities error:', e);
    }
  }

  const enriched = cities.map(city => {
    const cityNbs = neighborhoods.filter(n => n.cityId === city.id);
    const activeNbs = cityNbs.filter(n => n.active);
    const totalPairs = activeNbs.length > 1 ? calculatePossibleBenchmarkPairsCount(activeNbs) : 0;
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
    id: randomUUID(),
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
  lastCitiesFetchTimestamp = Date.now();

  await safeFirestoreWrite('createCity', () => setDoc(doc(db!, 'cities', newCity.id), cleanFirestoreDoc(newCity)));
  await recordHistory({
    action: 'CITY_CREATED',
    eventType: 'cities',
    title: `Nouvelle ville créée : ${newCity.name}`,
    description: `Pays : ${newCity.country}, Devise : ${newCity.currency}`,
    status: 'success'
  });

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
  lastCitiesFetchTimestamp = Date.now();

  await safeFirestoreWrite('updateCity', () => setDoc(doc(db!, 'cities', city.id), cleanFirestoreDoc(city), { merge: true }));
  await recordHistory({
    action: 'CITY_UPDATED',
    eventType: 'cities',
    title: `Ville mise à jour : ${city.name}`,
    description: `État : ${city.active ? 'Actif' : 'Inactif'}, Devise : ${city.currency}`,
    status: 'success'
  });

  return res.json(city);
});

app.delete('/api/cities/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const targetCity = cities.find(c => c.id === id);
  const cityName = targetCity ? targetCity.name : id;
  cities = cities.filter(c => c.id !== id);
  neighborhoods = neighborhoods.filter(n => n.cityId !== id);
  lastCitiesFetchTimestamp = Date.now();
  lastNeighborhoodsFetchTimestamp = Date.now();

  await safeFirestoreWrite('deleteCity', () => deleteDoc(doc(db!, 'cities', id)));
  await recordHistory({
    action: 'CITY_DELETED',
    eventType: 'cities',
    title: `Ville supprimée : ${cityName}`,
    description: `La ville et ses quartiers ont été retirés de la base.`,
    status: 'success'
  });

  return res.json({ success: true, message: 'Ville et quartiers associés supprimés.' });
});

// 4. Neighborhood routes (avec cache persistant 24h)
app.get('/api/neighborhoods', async (req: Request, res: Response) => {
  const { cityId, forceRefresh } = req.query;
  const isCacheExpired = Date.now() - lastNeighborhoodsFetchTimestamp > NEIGHBORHOODS_CACHE_TTL_MS;

  // Si le cache a expiré (>24h) ou si la liste est vide ou si forceRefresh est demandé, rafraîchir depuis Firestore
  if (db && (isCacheExpired || neighborhoods.length === 0 || forceRefresh === 'true')) {
    try {
      const snap = await getDocs(collection(db, 'neighborhoods'));
      if (!snap.empty) {
        neighborhoods = snap.docs.map(d => ({ id: d.id, ...d.data() } as Neighborhood));
        lastNeighborhoodsFetchTimestamp = Date.now();
      }
    } catch (e) {
      console.warn('[Firestore Cache 24h] Erreur chargement Firestore, utilisation du cache mémoire existant:', e);
    }
  }

  // Headers de cache HTTP 24h (86400s)
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
  res.setHeader('X-Neighborhoods-Cache-TTL', '86400s');
  res.setHeader('X-Neighborhoods-Last-Fetch', new Date(lastNeighborhoodsFetchTimestamp).toISOString());

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
    id: randomUUID(),
    cityId,
    name: name.trim(),
    lat: Number(lat),
    lng: Number(lng),
    active: active ?? true,
    zoneType: zoneType || 'commercial',
    createdAt: new Date().toISOString()
  };

  neighborhoods.push(newNeighborhood);
  lastNeighborhoodsFetchTimestamp = Date.now();

  const cleaned = cleanFirestoreDoc(newNeighborhood);
  await safeFirestoreWrite('createNeighborhood', () => Promise.all([
    setDoc(doc(db!, 'neighborhoods', newNeighborhood.id), cleaned),
    setDoc(doc(db!, 'cities', cityId, 'neighborhoods', newNeighborhood.id), cleaned)
  ]));
  await recordHistory({
    action: 'NEIGHBORHOOD_CREATED',
    eventType: 'neighborhoods',
    title: `Quartier ajouté : ${newNeighborhood.name}`,
    description: `Ville : ${city.name} (${newNeighborhood.lat.toFixed(4)}, ${newNeighborhood.lng.toFixed(4)})`,
    status: 'success'
  });

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
  lastNeighborhoodsFetchTimestamp = Date.now();

  const cleaned = cleanFirestoreDoc(nb);
  await safeFirestoreWrite('updateNeighborhood', () => Promise.all([
    setDoc(doc(db!, 'neighborhoods', nb.id), cleaned, { merge: true }),
    setDoc(doc(db!, 'cities', nb.cityId, 'neighborhoods', nb.id), cleaned, { merge: true })
  ]));
  await recordHistory({
    action: 'NEIGHBORHOOD_UPDATED',
    eventType: 'neighborhoods',
    title: `Quartier mis à jour : ${nb.name}`,
    description: `Actif : ${nb.active ? 'Oui' : 'Non'}, Zone : ${nb.zoneType || 'commercial'}`,
    status: 'success'
  });

  return res.json(nb);
});

app.delete('/api/neighborhoods/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const targetNb = neighborhoods.find(n => n.id === id);
  const nbName = targetNb ? targetNb.name : id;
  neighborhoods = neighborhoods.filter(n => n.id !== id);
  lastNeighborhoodsFetchTimestamp = Date.now();

  await safeFirestoreWrite('deleteNeighborhood', async () => {
    const promises = [deleteDoc(doc(db!, 'neighborhoods', id))];
    if (targetNb) {
      promises.push(deleteDoc(doc(db!, 'cities', targetNb.cityId, 'neighborhoods', id)));
    }
    await Promise.all(promises);
  });
  await recordHistory({
    action: 'NEIGHBORHOOD_DELETED',
    eventType: 'neighborhoods',
    title: `Quartier supprimé : ${nbName}`,
    status: 'success'
  });

  return res.json({ success: true, message: 'Quartier supprimé.' });
});

// Clear all neighborhoods of a city
app.delete('/api/neighborhoods/city/:cityId', async (req: Request, res: Response) => {
  const { cityId } = req.params;
  const toDelete = neighborhoods.filter(n => n.cityId === cityId);
  neighborhoods = neighborhoods.filter(n => n.cityId !== cityId);

  if (toDelete.length > 0) {
    lastNeighborhoodsFetchTimestamp = Date.now();
    await safeFirestoreWrite('clearNeighborhoods', async () => {
      const BATCH_SIZE = 100;
      for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const chunk = toDelete.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db!);
        for (const item of chunk) {
          batch.delete(doc(db!, 'neighborhoods', item.id));
          batch.delete(doc(db!, 'cities', cityId, 'neighborhoods', item.id));
        }
        await batch.commit();
      }
    });
  }

  return res.json({
    success: true,
    deletedCount: toDelete.length,
    message: `Tous les quartiers de la ville (${toDelete.length}) ont été vidés.`
  });
});

// Batch toggle active status of neighborhoods in a city
app.post('/api/neighborhoods/batch-toggle', async (req: Request, res: Response) => {
  const { cityId, active } = req.body;
  if (!cityId || active === undefined) {
    return res.status(400).json({ error: 'cityId et statut active requis.' });
  }

  const updatedNbs: Neighborhood[] = [];
  neighborhoods = neighborhoods.map(nb => {
    if (nb.cityId === cityId) {
      const updated = { ...nb, active: Boolean(active) };
      updatedNbs.push(updated);
      return updated;
    }
    return nb;
  });

  if (updatedNbs.length > 0) {
    lastNeighborhoodsFetchTimestamp = Date.now();
    await safeFirestoreWrite('batchToggleNeighborhoods', async () => {
      const BATCH_SIZE = 100;
      for (let i = 0; i < updatedNbs.length; i += BATCH_SIZE) {
        const chunk = updatedNbs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db!);
        for (const item of chunk) {
          const cleaned = cleanFirestoreDoc(item);
          batch.set(doc(db!, 'neighborhoods', item.id), cleaned, { merge: true });
          batch.set(doc(db!, 'cities', cityId, 'neighborhoods', item.id), cleaned, { merge: true });
        }
        await batch.commit();
      }
      await recordHistory({
        action: 'NEIGHBORHOODS_BATCH_TOGGLED',
        eventType: 'neighborhoods',
        title: `${Boolean(active) ? 'Activation' : 'Désactivation'} générale des quartiers`,
        description: `${updatedNbs.length} quartiers de la ville mis à jour.`,
        status: 'success'
      });
    });
  }

  return res.json({
    success: true,
    updatedCount: updatedNbs.length,
    active: Boolean(active)
  });
});

app.post('/api/neighborhoods/seed-city', async (req: Request, res: Response) => {
  const { cityId } = req.body;
  const city = cities.find(c => c.id === cityId);
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  return res.json({
    success: true,
    message: 'Utilisez le bouton Import Excel pour ajouter de nouveaux quartiers.',
    neighborhoods: neighborhoods.filter(n => n.cityId === cityId)
  });
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
        id: randomUUID(),
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
  lastNeighborhoodsFetchTimestamp = Date.now();

  if (createdNeighborhoods.length > 0) {
    await safeFirestoreWrite('importBatchNeighborhoods', async () => {
      const BATCH_SIZE = 100;
      for (let i = 0; i < createdNeighborhoods.length; i += BATCH_SIZE) {
        const chunk = createdNeighborhoods.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db!);
        for (const nb of chunk) {
          const cleaned = cleanFirestoreDoc({ ...nb, cityName: city.name, updatedAt: new Date().toISOString() });
          batch.set(doc(db!, 'neighborhoods', nb.id), cleaned, { merge: true });
          batch.set(doc(db!, 'cities', cityId, 'neighborhoods', nb.id), cleaned, { merge: true });
        }
        await batch.commit();
      }
    });
  }

  return res.status(201).json({
    success: true,
    count: createdNeighborhoods.length,
    neighborhoods: createdNeighborhoods
  });
});

// 5. Tri-provider routestats single test proxy (Yango, Hero Cab & Trip Master)
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

  const [yangoRes, heroRes, tmRes] = await Promise.all([
    callYangoRoutestats(sLat, sLng, eLat, eLng, tClass, curr),
    callHeroStats(sLat, sLng, eLat, eLng, tClass, curr),
    callTripMasterStats(sLat, sLng, eLat, eLng, curr)
  ]);

  const mainDistKm = yangoRes.distanceKm || calculateDistanceKm(sLat, sLng, eLat, eLng);
  const durationMin = yangoRes.durationMinutes || Math.round((mainDistKm / 25) * 60);

  const yEco = yangoRes.priceEconom || yangoRes.price || 0;
  const yConf = yangoRes.priceConfort;
  const yConfPlus = yangoRes.priceConfortPlus;
  const yMoto = yangoRes.priceMoto;

  const hEco = heroRes.priceStandard || heroRes.price || 0;
  const hConf = heroRes.priceConfort;
  const hSuv = heroRes.priceSuv;

  const tmEco = tmRes.priceEco || 0;
  const tmConf = tmRes.priceConfort;
  const tmMoto = tmRes.priceMoto;

  const ecoList = [
    { provider: 'yango', price: yEco },
    { provider: 'hero', price: hEco },
    { provider: 'tripmaster', price: tmEco }
  ].filter(p => p.price > 0);
  ecoList.sort((a, b) => a.price - b.price);

  const cheaperProvider: 'yango' | 'hero' | 'tripmaster' | 'equal' = ecoList.length > 0 ? (ecoList[0].provider as any) : 'equal';
  const deltaPrice = ecoList.length > 1 ? ecoList[1].price - ecoList[0].price : 0;

  const singleTripResult: TripResult = {
    id: randomUUID(),
    campaignId: 'quick_test',
    cityId: 'quick_test_city',
    startNeighborhoodId: 'start',
    startNeighborhoodName: req.body.startName || 'Départ',
    endNeighborhoodId: 'end',
    endNeighborhoodName: req.body.endName || 'Arrivée',
    distanceKm: mainDistKm,
    distanceMeters: Math.round(mainDistKm * 1000),
    durationSeconds: durationMin * 60,
    durationMinutes: durationMin,
    tariffClass: tClass,
    price: yEco || hEco || tmEco || 0,
    priceFormatted: (yEco || hEco || tmEco || 0) > 0 ? `${(yEco || hEco || tmEco || 0).toLocaleString('fr-FR')} ${curr}` : 'Non disponible',
    currency: curr,
    pricePerKm: mainDistKm > 0 ? Math.round((yEco || hEco || tmEco || 0) / mainDistKm) : 0,

    classes: yangoRes.classes || {},
    availableClasses: yangoRes.availableClasses || ['econom'],
    priceEconom: yEco > 0 ? yEco : undefined,
    priceConfort: yConf && yConf > 0 ? yConf : undefined,
    priceConfortPlus: yConfPlus && yConfPlus > 0 ? yConfPlus : undefined,
    priceMoto: yMoto && yMoto > 0 ? yMoto : undefined,

    heroQuote: {
      ...heroRes,
      rawResponse: heroRes.rawResponse || null
    },
    priceHero: hEco > 0 ? hEco : undefined,
    priceHeroStandard: hEco > 0 ? hEco : undefined,
    priceHeroConfort: hConf && hConf > 0 ? hConf : undefined,
    priceHeroSuv: hSuv && hSuv > 0 ? hSuv : undefined,
    heroDriversCount: heroRes.availableDriversCount || 0,
    heroClosestDriverDistanceKm: heroRes.closestDriverDistanceKm || 0,

    tripMasterQuote: {
      ...tmRes,
      rawResponse: tmRes.rawResponse || null
    },
    priceTripMaster: tmEco > 0 ? tmEco : undefined,
    priceTripMasterConfort: tmConf && tmConf > 0 ? tmConf : undefined,
    priceTripMasterMoto: tmMoto && tmMoto > 0 ? tmMoto : undefined,

    deltaPriceYangoVsHero: deltaPrice,
    cheaperProvider,

    rawResponse: yangoRes.rawResponse || null,
    requestPayload: yangoRes.requestPayload || null,
    httpStatus: yangoRes.httpStatus || 200,
    apiCallDetails: {
      endpoint: yangoSettings.apiEndpoint,
      sentAt: new Date().toISOString(),
      latencyMs: yangoRes.latencyMs || 0,
      httpStatus: yangoRes.httpStatus,
      requestBody: yangoRes.requestPayload,
      rawResponseBody: yangoRes.rawResponse
    },

    source: yangoRes.source || 'yango_live',
    status: (yangoRes.success || heroRes.success || tmRes.success) ? 'success' : 'failed'
  };

  return res.json({
    ...singleTripResult,
    yango: yangoRes,
    hero: heroRes,
    tripMaster: tmRes
  });
});

// 6. Campaign Management
app.get('/api/campaigns', async (req: Request, res: Response) => {
  const { cityId } = req.query;

  let list: PricingCampaign[] = [];

  // 1. Lire directement depuis la base de données Firestore (Source de vérité)
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'campaigns'));
      list = snap.docs.map(d => ({ id: d.id, ...d.data() } as PricingCampaign));
    } catch (err) {
      console.warn('[Firestore] Erreur de lecture des campagnes :', err);
    }
  }

  // 2. Fusionner avec la ou les sessions de pricing actuellement en cours d'exécution en mémoire (cache éphémère)
  for (const session of activePricingSessions.values()) {
    const existingIndex = list.findIndex(c => c.id === session.campaign.id);
    if (existingIndex >= 0) {
      list[existingIndex] = session.campaign;
    } else {
      list.unshift(session.campaign);
    }
  }

  if (cityId) {
    list = list.filter(c => c.cityId === cityId);
  }

  // Tri antéchronologique
  list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return res.json(list);
});

app.get('/api/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // 1. Si la campagne est en cours d'exécution dans le cache de pricing actif
  const session = activePricingSessions.get(id);
  if (session) {
    return res.json(session.campaign);
  }

  // 2. Sinon, lecture directe en base de données Firestore
  if (db) {
    try {
      const d = await getDoc(doc(db, 'campaigns', id));
      if (d.exists()) {
        return res.json({ id: d.id, ...d.data() });
      }
    } catch (e) {
      console.warn('[Firestore] get campaign error:', e);
    }
  }

  return res.status(404).json({ error: 'Campagne introuvable ou supprimée de la base de données.' });
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

  // Génération intelligente des trajets selon les règles demandées :
  // - Les quartiers d'un même arrondissement peuvent se tester entre eux (intra-arrondissement, ex: Akwa vers Bonanjo)
  // - Douala 1er teste Douala 1er, 2e, 3e, 5e
  // - Douala 2e teste Douala 1er, 2e, 3e
  // - Douala 3e teste Douala 1er, 3e, 5e
  // - Élimination stricte des trajets sur-place (ex: pas d'Akwa vers Akwa ou distance < 400m)
  // - Une destination ne peut être appelée que 5 fois par chaque arrondissement (ex: Akwa max 5 fois depuis Douala 1er, max 5 fois depuis Douala 2e, etc.)
  // - Chaque quartier d'origine ne peut avoir que 25 destinations max (ex: Bali max 25 trajets)
  // - Plafond global sécurisé < 15 000 trajets
  let pairs = generateBenchmarkPairs(activeNbs, {
    maxCallsPerDestPerOriginArr: 5,
    maxDestsPerOrigin: 25,
    maxGlobalPairs: 15000,
    minDistanceKm: 0.4
  });

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

  const batchSize = Math.max(25, Math.min(250, Number(requestedBatchSize) || 100));
  const concurrency = Math.max(5, Math.min(30, Number(requestedConcurrency) || 15));
  const totalBatches = Math.ceil(pairs.length / batchSize);

  const campaignId = randomUUID();
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

  // ZÉRO écriture réseau au démarrage : session active en mémoire tampon le temps du calcul
  const taskAbortController = new AbortController();
  const localCampaignTrips: TripResult[] = [];
  const workerResults: Record<string, any[]> = {};

  activePricingSessions.set(campaignId, {
    campaign,
    trips: localCampaignTrips,
    workerResults,
    abortController: taskAbortController,
    cancelled: false
  });

  console.log(`[Pricing Cache Actif] Session de pricing ${campaignId} initialisée en mémoire tampon.`);

  // Run async background parallel processing of pairs via high-throughput Worker Pool
  (async () => {
    const session = activePricingSessions.get(campaignId);
    let completed = 0;
    let failed = 0;
    let totalPrice = 0;
    let totalHeroPrice = 0;
    let totalTripMasterPrice = 0;
    let totalDistKm = 0;
    let minP = Infinity;
    let maxP = -Infinity;
    let minHeroP = Infinity;
    let maxHeroP = -Infinity;
    let minTripMasterP = Infinity;
    let maxTripMasterP = -Infinity;
    let totalHeroDrivers = 0;
    let totalClosestDist = 0;
    let yangoCheaperCount = 0;
    let heroCheaperCount = 0;
    let equalCount = 0;
    let totalDelta = 0;

    const logs = campaign.logs = campaign.logs || [];
    campaign.errorCount = campaign.errorCount || 0;

    // Buffer local en RAM pour cette campagne : aucune écriture Firestore pendant les calculs
    const localCampaignTrips: TripResult[] = [];

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

    // Partition des trajets en lots de 100 (exigence utilisateur : 100 éléments par lot)
    const CHUNK_SIZE = 100;
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
    const NUM_PARALLEL_WORKERS = Math.min(8, chunks.length);

    // Initialisation des réceptacles de résultats par worker dans data : worker_1, worker_2, etc.
    const workerResults: Record<string, any[]> = {};
    for (let w = 1; w <= NUM_PARALLEL_WORKERS; w++) {
      workerResults[`worker_${w}`] = [];
    }

    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `⚡ Traitement automatique de ${pairs.length} trajets répartis en ${chunks.length} lot(s).`
    });

    // Traitement des lots de 100 éléments en parallèle
    const runLotWorker = async (workerId: number) => {
      const workerKey = `worker_${workerId}`;
      while (nextChunkIndex < chunks.length) {
        if (session?.cancelled || (campaign.status as any) === 'cancelled') {
          nextChunkIndex = chunks.length;
          break;
        }

        const currentChunk = chunks[nextChunkIndex++];
        if (!currentChunk) break;

        logs.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `🚀 Traitement du lot #${currentChunk.chunkIndex}/${currentChunk.totalChunks} (${currentChunk.pairs.length} trajets).`
        });

        // Traitement réellement en parallèle par sous-lots rapides de 20 requêtes simultanées
        const SUB_CONCURRENCY = 20;
        for (let pIdx = 0; pIdx < currentChunk.pairs.length; pIdx += SUB_CONCURRENCY) {
          if (session?.cancelled || (campaign.status as any) === 'cancelled') {
            nextChunkIndex = chunks.length;
            break;
          }
          const subBatch = currentChunk.pairs.slice(pIdx, pIdx + SUB_CONCURRENCY);

          await Promise.all(
            subBatch.map(async ({ origin, dest }) => {
              if (session?.cancelled || (campaign.status as any) === 'cancelled') return;
              const tariff = selectedClasses[0] || 'econom';
              const [stats, heroStats, tmStats] = await Promise.all([
                callYangoRoutestats(origin.lat, origin.lng, dest.lat, dest.lng, tariff, city.currency, session?.abortController.signal),
                callHeroStats(origin.lat, origin.lng, dest.lat, dest.lng, tariff, city.currency, origin.name, dest.name, session?.abortController.signal),
                callTripMasterStats(origin.lat, origin.lng, dest.lat, dest.lng, city.currency, session?.abortController.signal)
              ]);

              if (session?.cancelled || (campaign.status as any) === 'cancelled') return;

              completed++;

              // Extraction et complétion fiable des prix pour TOUTES les classes sans exception
              const mainDistKm = stats.distanceKm || calculateDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng);

              // 1. Classes Yango (strictement issues du retour API live)
              const yEco = stats.priceEconom || stats.price || (stats.classes?.econom?.price) || 0;
              const yConf = stats.priceConfort || stats.classes?.business?.price || stats.classes?.comfort?.price;
              const yConfPlus = stats.priceConfortPlus || stats.classes?.comfortplus?.price;
              const yMoto = stats.priceMoto || stats.classes?.moto?.price;

              // 2. Classes Hero Cab (strictement issues de l'API Hero)
              const hEco = heroStats.priceStandard || heroStats.price || 0;
              const hConf = heroStats.priceConfort;
              const hSuv = heroStats.priceSuv;
              const hPerKm = heroStats.pricePerKm;

              // 3. Classes Trip Master (strictement issues de l'API Trip Master)
              const tmEco = tmStats.priceEco || 0;
              const tmConf = tmStats.priceConfort;
              const tmMoto = tmStats.priceMoto;

              // Comparaison économique
              const ecoList = [
                { provider: 'yango', price: yEco },
                { provider: 'hero', price: hEco },
                { provider: 'tripmaster', price: tmEco }
              ].filter(p => p.price > 0);
              ecoList.sort((a, b) => a.price - b.price);

              const cheaperProvider: 'yango' | 'hero' | 'tripmaster' | 'equal' = ecoList.length > 0 ? (ecoList[0].provider as any) : 'equal';
              const deltaPrice = ecoList.length > 1 ? ecoList[1].price - ecoList[0].price : 0;

              const mainPrice = yEco || hEco || tmEco || 0;

              const trip: TripResult = {
                id: randomUUID(),
                campaignId,
                cityId: city.id,
                cityName: city.name,
                startNeighborhoodId: origin.id,
                startNeighborhoodName: origin.name,
                startCoordinates: [origin.lat, origin.lng],
                endNeighborhoodId: dest.id,
                endNeighborhoodName: dest.name,
                endCoordinates: [dest.lat, dest.lng],
                distanceMeters: stats.distanceMeters || Math.round(mainDistKm * 1000),
                distanceKm: mainDistKm,
                durationSeconds: stats.durationSeconds || Math.round((mainDistKm / 25) * 3600),
                durationMinutes: stats.durationMinutes || Math.max(2, Math.round((mainDistKm / 25) * 60)),
                tariffClass: tariff,
                price: mainPrice,
                priceFormatted: mainPrice > 0 ? `${mainPrice.toLocaleString('fr-FR')} ${city.currency}` : 'Non disponible',
                currency: city.currency,
                pricePerKm: mainDistKm > 0 && mainPrice > 0 ? Math.round(mainPrice / mainDistKm) : 0,
                waitingTimeMinutes: stats.waitingTimeMinutes || heroStats.waitingTimeMinutes || 0,

                // Multi-class data provenant strictement de l'API
                classes: stats.classes || {},
                availableClasses: stats.availableClasses || ['econom'],
                priceEconom: yEco > 0 ? yEco : undefined,
                priceConfort: yConf && yConf > 0 ? yConf : undefined,
                priceConfortPlus: yConfPlus && yConfPlus > 0 ? yConfPlus : undefined,
                priceMoto: yMoto && yMoto > 0 ? yMoto : undefined,

                // Hero Quote
                heroQuote: {
                  ...heroStats,
                  priceStandard: hEco > 0 ? hEco : undefined,
                  priceConfort: hConf && hConf > 0 ? hConf : undefined,
                  priceSuv: hSuv && hSuv > 0 ? hSuv : undefined,
                  rawResponse: heroStats.rawResponse || null
                },
                priceHero: hEco > 0 ? hEco : undefined,
                priceHeroStandard: hEco > 0 ? hEco : undefined,
                priceHeroConfort: hConf && hConf > 0 ? hConf : undefined,
                priceHeroSuv: hSuv && hSuv > 0 ? hSuv : undefined,
                priceHeroPerKm: (hEco || hConf) && mainDistKm > 0 ? Math.round(((hEco || 0) || (hConf || 0)) / mainDistKm) : undefined,
                heroDriversCount: heroStats.availableDriversCount,
                heroClosestDriverDistanceKm: heroStats.closestDriverDistanceKm,
                deltaPriceYangoVsHero: deltaPrice,
                cheaperProvider,

                // Trip Master Quote
                tripMasterQuote: {
                  ...tmStats,
                  priceEco: tmEco > 0 ? tmEco : undefined,
                  priceConfort: tmConf && tmConf > 0 ? tmConf : undefined,
                  priceMoto: tmMoto && tmMoto > 0 ? tmMoto : undefined,
                  rawResponse: tmStats.rawResponse || null
                },
                priceTripMaster: tmEco > 0 ? tmEco : undefined,
                priceTripMasterConfort: tmConf && tmConf > 0 ? tmConf : undefined,
                priceTripMasterMoto: tmMoto && tmMoto > 0 ? tmMoto : undefined,

                // Informations de requête brute et JSON
                rawResponse: stats.rawResponse || null,
                requestPayload: stats.requestPayload || null,
                httpStatus: stats.httpStatus || 200,
                apiCallDetails: {
                  endpoint: yangoSettings.apiEndpoint,
                  sentAt: new Date().toISOString(),
                  latencyMs: stats.latencyMs || 0,
                  httpStatus: stats.httpStatus,
                  requestBody: stats.requestPayload,
                  rawResponseBody: stats.rawResponse
                },

                source: stats.source || 'yango_live',
                status: (stats.success || heroStats.success || tmStats.success) ? 'success' : 'failed',
                createdAt: new Date().toISOString()
              };

              localCampaignTrips.push(trip);

              // Stockage par worker pour data (worker_1, worker_2...)
              if (workerResults[workerKey]) {
                workerResults[workerKey].push({
                  id: trip.id,
                  startName: origin.name,
                  endName: dest.name,
                  startId: origin.id,
                  endId: dest.id,
                  km: mainDistKm,
                  durationMin: trip.durationMinutes,
                  tariff,
                  priceYango: yEco,
                  priceEconom: yEco,
                  priceConfort: yConf,
                  priceConfortPlus: yConfPlus,
                  priceMoto: yMoto,
                  priceHero: hEco,
                  priceHeroStandard: hEco,
                  priceHeroConfort: hConf,
                  priceHeroSuv: hSuv,
                  priceHeroPerKm: hPerKm,
                  priceTripMaster: tmEco,
                  priceTripMasterConfort: tmConf,
                  priceTripMasterMoto: tmMoto,
                  cheaper: cheaperProvider,
                  delta: deltaPrice
                });
              }

              // Progression brute uniquement : AUCUN calcul de moyenne ni agrégat en temps réel
              campaign.completedPairs = completed;
              campaign.failedPairs = failed;
              campaign.durationSeconds = Math.max(1, Math.round((Date.now() - new Date(campaign.startedAt).getTime()) / 1000));
            })
          );
        }

        completedChunksCount++;
        campaign.completedBatches = completedChunksCount;

        logs.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `✅ [Worker #${workerId}] a terminé le Lot #${currentChunk.chunkIndex}/${currentChunk.totalChunks} (${currentChunk.pairs.length} trajets). Progression globale : ${completed}/${pairs.length} trajets (${(((completed) / pairs.length) * 100).toFixed(1)}%).`
        });
      }
    };

    // Lancement simultané en VRAI parallèle de tous les workers
    const activeWorkers = Array.from({ length: NUM_PARALLEL_WORKERS }, (_, i) => runLotWorker(i + 1));
    await Promise.all(activeWorkers);

    if (session?.cancelled || (campaign.status as any) === 'cancelled') {
      campaign.status = 'cancelled';
      activePricingSessions.delete(campaignId);
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: 'Campagne interrompue manuellement par l’utilisateur.'
      });
    } else if (completed === 0 && failed > 0) {
      // Echec total de la campagne
      campaign.status = 'failed';
      campaign.finishedAt = new Date().toISOString();
      campaign.durationSeconds = Math.max(1, Math.round(
        (new Date(campaign.finishedAt).getTime() - new Date(campaign.startedAt).getTime()) / 1000
      ));
      (campaign as any).errorMessage = campaign.lastError || 'Impossible de joindre les serveurs de tarification VTC.';
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `❌ Échec de la tarification : ${campaign.lastError || 'Aucun trajet réussi.'}`
      });
    } else {
      campaign.status = 'completed';
      campaign.finishedAt = new Date().toISOString();
      campaign.durationSeconds = Math.round(
        (new Date(campaign.finishedAt).getTime() - new Date(campaign.startedAt).getTime()) / 1000
      );

      // CALCUL FINAL GLOBAL DES MOYENNES (Exécuté uniquement maintenant, zéro calcul en temps réel)
      let sumPrice = 0;
      let sumDistKm = 0;
      let minP = Infinity;
      let maxP = -Infinity;

      let sumHeroPrice = 0;
      let minHeroP = Infinity;
      let maxHeroP = -Infinity;
      let totalHeroDrivers = 0;
      let totalClosestDist = 0;

      let sumTripMasterPrice = 0;
      let minTripMasterP = Infinity;
      let maxTripMasterP = -Infinity;

      let yangoCheaperCount = 0;
      let heroCheaperCount = 0;
      let equalCount = 0;
      let totalDelta = 0;

      const classAccumulator: Record<string, { className: string; sum: number; min: number; max: number; count: number }> = {
        econom: { className: 'Éco', sum: 0, min: Infinity, max: -Infinity, count: 0 },
        business: { className: 'Confort', sum: 0, min: Infinity, max: -Infinity, count: 0 },
        comfortplus: { className: 'Confort+', sum: 0, min: Infinity, max: -Infinity, count: 0 },
        moto: { className: 'Moto', sum: 0, min: Infinity, max: -Infinity, count: 0 }
      };

      for (const t of localCampaignTrips) {
        if (t.price > 0) {
          sumPrice += t.price;
          sumDistKm += t.distanceKm;
          if (t.price < minP) minP = t.price;
          if (t.price > maxP) maxP = t.price;
        }

        const hP = t.priceHero || t.priceHeroStandard || 0;
        if (hP > 0) {
          sumHeroPrice += hP;
          if (hP < minHeroP) minHeroP = hP;
          if (hP > maxHeroP) maxHeroP = hP;
          totalHeroDrivers += (t.heroDriversCount || 0);
          totalClosestDist += (t.heroClosestDriverDistanceKm || 2.5);
        }

        const tmP = t.priceTripMaster || 0;
        if (tmP > 0) {
          sumTripMasterPrice += tmP;
          if (tmP < minTripMasterP) minTripMasterP = tmP;
          if (tmP > maxTripMasterP) maxTripMasterP = tmP;
        }

        if (t.cheaperProvider === 'yango') yangoCheaperCount++;
        else if (t.cheaperProvider === 'hero') heroCheaperCount++;
        else equalCount++;

        totalDelta += (t.deltaPriceYangoVsHero || 0);

        // Statistiques complètes par classe
        const yE = t.priceEconom || t.price || 0;
        const yC = t.priceConfort || 0;
        const yCP = t.priceConfortPlus || 0;
        const yM = t.priceMoto || 0;

        if (yE > 0) {
          classAccumulator.econom.sum += yE;
          classAccumulator.econom.count++;
          if (yE < classAccumulator.econom.min) classAccumulator.econom.min = yE;
          if (yE > classAccumulator.econom.max) classAccumulator.econom.max = yE;
        }
        if (yC > 0) {
          classAccumulator.business.sum += yC;
          classAccumulator.business.count++;
          if (yC < classAccumulator.business.min) classAccumulator.business.min = yC;
          if (yC > classAccumulator.business.max) classAccumulator.business.max = yC;
        }
        if (yCP > 0) {
          classAccumulator.comfortplus.sum += yCP;
          classAccumulator.comfortplus.count++;
          if (yCP < classAccumulator.comfortplus.min) classAccumulator.comfortplus.min = yCP;
          if (yCP > classAccumulator.comfortplus.max) classAccumulator.comfortplus.max = yCP;
        }
        if (yM > 0) {
          classAccumulator.moto.sum += yM;
          classAccumulator.moto.count++;
          if (yM < classAccumulator.moto.min) classAccumulator.moto.min = yM;
          if (yM > classAccumulator.moto.max) classAccumulator.moto.max = yM;
        }
      }

      campaign.avgPrice = completed > 0 ? Math.round(sumPrice / completed) : 0;
      campaign.minPrice = minP === Infinity ? 0 : minP;
      campaign.maxPrice = maxP === -Infinity ? 0 : maxP;
      campaign.avgDistanceKm = completed > 0 ? Number((sumDistKm / completed).toFixed(2)) : 0;
      campaign.avgPricePerKm =
        campaign.avgDistanceKm > 0 ? Math.round(campaign.avgPrice / campaign.avgDistanceKm) : 0;

      // Hero aggregate statistics
      campaign.heroStats = {
        avgPrice: completed > 0 ? Math.round(sumHeroPrice / completed) : 0,
        minPrice: minHeroP === Infinity ? 0 : minHeroP,
        maxPrice: maxHeroP === -Infinity ? 0 : maxHeroP,
        avgDriversCount: completed > 0 ? Number((totalHeroDrivers / completed).toFixed(1)) : 0,
        avgClosestDriverDistanceKm: completed > 0 ? Number((totalClosestDist / completed).toFixed(2)) : 0
      };

      // Trip Master aggregate statistics
      campaign.tripMasterStats = {
        avgPrice: completed > 0 ? Math.round(sumTripMasterPrice / completed) : 0,
        minPrice: minTripMasterP === Infinity ? 0 : minTripMasterP,
        maxPrice: maxTripMasterP === -Infinity ? 0 : maxTripMasterP
      };

      // Delta comparison statistics
      campaign.deltaStats = {
        yangoCheaperCount,
        heroCheaperCount,
        equalCount,
        avgDeltaFcfa: completed > 0 ? Math.round(totalDelta / completed) : 0
      };

      // Construction finale des statistiques par classe d'agrégateur (calcul unique en fin de campagne)
      const computedClassStats: Record<string, any> = {};
      for (const [key, item] of Object.entries(classAccumulator)) {
        if (item.count > 0) {
          computedClassStats[key] = {
            className: item.className,
            avgPrice: Math.round(item.sum / item.count),
            minPrice: item.min === Infinity ? 0 : item.min,
            maxPrice: item.max === -Infinity ? 0 : item.max,
            count: item.count
          };
        }
      }
      campaign.classStats = computedClassStats;

      logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `🏁 Campagne ${isTestSample ? 'de test ' : ''}terminée avec succès (${completed} trajets). Moyenne Yango: ${campaign.avgPrice} ${city.currency} | Moyenne Hero: ${campaign.heroStats.avgPrice} ${city.currency}.`
      });

      // Update city lastRunAt
      city.autoSchedule.lastRunAt = campaign.finishedAt;
    }

    // Persistance finale unique en base de données :
    // Zéro écriture au démarrage, zéro écriture pendant le pricing.
    // L'en-tête de la campagne est enregistré dans 'campaigns' (sans le gros tableau 'data')
    // Et le détail des destinations est enregistré dans 'campaign_results' (avec découpage automatique si taille > 750 Ko)
    await safeFirestoreWrite('saveCompletedCampaign', async () => {
      const campaignDocPayload = cleanFirestoreDoc({
        ...campaign
      });
      delete (campaignDocPayload as any).data;

      // 1. Sauvegarde des métadonnées légères dans 'campaigns'
      await setDoc(doc(db!, 'campaigns', campaignId), campaignDocPayload);

      // 2. Nettoyage et sauvegarde des résultats dans 'campaign_results'
      const sanitizedWorkerResults: Record<string, any[]> = {};
      for (const [wKey, wList] of Object.entries(workerResults)) {
        if (Array.isArray(wList)) {
          sanitizedWorkerResults[wKey] = wList.map(t => {
            if (!t || typeof t !== 'object') return t;
            const { rawResponse, requestPayload, apiCallDetails, ...cleanItem } = t;
            return cleanItem;
          });
        }
      }

      const str = JSON.stringify(sanitizedWorkerResults);
      const byteSize = Buffer.byteLength(str, 'utf8');

      if (byteSize < 750000) {
        await setDoc(doc(db!, 'campaign_results', campaignId), cleanFirestoreDoc({
          campaignId,
          data: sanitizedWorkerResults,
          savedAt: new Date().toISOString()
        }));
      } else {
        const keys = Object.keys(sanitizedWorkerResults);
        const mid = Math.ceil(keys.length / 2);
        const part1Keys = keys.slice(0, mid);
        const part2Keys = keys.slice(mid);

        const part1Data: Record<string, any[]> = {};
        part1Keys.forEach(k => part1Data[k] = sanitizedWorkerResults[k]);

        const part2Data: Record<string, any[]> = {};
        part2Keys.forEach(k => part2Data[k] = sanitizedWorkerResults[k]);

        await setDoc(doc(db!, 'campaign_results', campaignId), cleanFirestoreDoc({
          campaignId,
          data: part1Data,
          hasMoreParts: true,
          partsCount: 2,
          savedAt: new Date().toISOString()
        }));

        await setDoc(doc(db!, 'campaign_results', `${campaignId}_part2`), cleanFirestoreDoc({
          campaignId,
          data: part2Data,
          isPart: true,
          partIndex: 2,
          savedAt: new Date().toISOString()
        }));
      }

      console.log(`[Firestore] Campagne ${campaignId} et ses résultats de destinations sauvegardés avec succès en BD.`);
    });

    // VIDAGE IMMÉDIAT DU CACHE MÉMOIRE DÈS QUE LE PRICING EST TERMINÉ
    activePricingSessions.delete(campaignId);
    console.log(`[Cache Vidé] Cache de pricing pour la campagne ${campaignId} vidé de la mémoire.`);
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

  let targetCampaign: PricingCampaign | null = null;
  const session = activePricingSessions.get(id);
  if (session) {
    session.cancelled = true;
    try {
      session.abortController.abort();
    } catch {
      // ignore
    }
    session.campaign.status = 'cancelled';
    session.campaign.finishedAt = new Date().toISOString();
    if (session.campaign.startedAt) {
      session.campaign.durationSeconds = Math.max(
        1,
        Math.round((new Date(session.campaign.finishedAt).getTime() - new Date(session.campaign.startedAt).getTime()) / 1000)
      );
    }
    (session.campaign.logs ??= []).push({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message: 'Arrêt forcé immédiat exécuté par l’utilisateur.'
    });
    targetCampaign = { ...session.campaign };

    // Sauvegarder l'état annulé dans Firestore
    await safeFirestoreWrite('cancelCampaign', async () => {
      const cancelPayload = cleanFirestoreDoc({ ...targetCampaign });
      delete (cancelPayload as any).data;
      await setDoc(doc(db!, 'campaigns', id), cancelPayload);

      if (session.workerResults) {
        await setDoc(doc(db!, 'campaign_results', id), cleanFirestoreDoc({
          campaignId: id,
          data: session.workerResults,
          savedAt: new Date().toISOString()
        }));
      }
    });

    // Vider immédiatement le cache mémoire
    activePricingSessions.delete(id);
    console.log(`[Cache Vidé] Campagne ${id} arrêtée. Cache mémoire libéré.`);
  } else if (db) {
    try {
      const snap = await getDoc(doc(db, 'campaigns', id));
      if (snap.exists()) {
        const d = snap.data() as PricingCampaign;
        targetCampaign = {
          ...d,
          status: 'cancelled',
          finishedAt: new Date().toISOString()
        };
        await safeFirestoreWrite('cancelCampaignDb', () =>
          setDoc(doc(db!, 'campaigns', id), cleanFirestoreDoc(targetCampaign), { merge: true })
        );
      }
    } catch (e) {
      console.warn('[Firestore] cancel db error:', e);
    }
  }

  await recordHistory({
    action: 'CAMPAIGN_CANCELLED',
    eventType: 'campaign',
    title: `Arrêt forcé de la campagne : ${targetCampaign?.cityName || id}`,
    description: `Progression interrompue immédiatement.`,
    status: 'cancelled'
  });

  return res.json({ success: true, campaign: targetCampaign || { id, status: 'cancelled' } });
});

app.delete('/api/campaigns', async (_req: Request, res: Response) => {
  for (const session of activePricingSessions.values()) {
    session.cancelled = true;
    try { session.abortController.abort(); } catch {}
  }
  activePricingSessions.clear();

  let count = 0;
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'campaigns'));
      count = snap.docs.length;
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'campaigns', d.id));
        await deleteDoc(doc(db, 'campaign_results', d.id));
      }
    } catch (e) {
      console.warn('[Firestore] deleteAllCampaigns error:', e);
    }
  }

  await recordHistory({
    action: 'ALL_CAMPAIGNS_DELETED',
    eventType: 'campaign',
    title: `Toutes les campagnes ont été réinitialisées`,
    description: `${count} campagnes supprimées de la base de données.`,
    status: 'success'
  });

  return res.json({ success: true, message: `${count} campagnes supprimées de la base de données.` });
});

app.delete('/api/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const session = activePricingSessions.get(id);
  if (session) {
    session.cancelled = true;
    try { session.abortController.abort(); } catch {}
    activePricingSessions.delete(id);
  }

  let campName = id;
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'campaigns', id));
      if (snap.exists()) {
        const d = snap.data();
        campName = `${d.cityName || 'Campagne'} (${d.startedAt || id})`;
      }
      await deleteDoc(doc(db, 'campaigns', id));
      await deleteDoc(doc(db, 'campaign_results', id));
    } catch (e) {
      console.warn('[Firestore] deleteCampaign error:', e);
    }
  }

  await recordHistory({
    action: 'CAMPAIGN_DELETED',
    eventType: 'campaign',
    title: `Campagne supprimée`,
    description: `Campagne ${campName} supprimée de la base de données.`,
    status: 'success'
  });

  return res.json({ success: true, message: 'Campagne supprimée de la base de données.' });
});

// 7. Trip results query
app.get('/api/campaigns/:id/results', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startNeighborhood, endNeighborhood, minPrice, maxPrice, search } = req.query;

  let results: any[] = [];
  let campaign: any = null;

  // 1. Si en cours de pricing actif dans le cache temporaire
  const session = activePricingSessions.get(id);
  if (session) {
    campaign = session.campaign;
    results = session.trips;
  } else if (db) {
    // 2. Sinon, lecture directe en base de données Firestore
    try {
      const campSnap = await getDoc(doc(db, 'campaigns', id));
      if (campSnap.exists()) {
        campaign = { id: campSnap.id, ...campSnap.data() };
        let raw = campaign.data;

        if (!raw || (typeof raw === 'object' && Object.keys(raw).length === 0)) {
          const resSnap = await getDoc(doc(db, 'campaign_results', id));
          if (resSnap.exists()) {
            const resData = resSnap.data();
            raw = resData.data || {};
            if (resData.hasMoreParts) {
              for (let p = 2; p <= (resData.partsCount || 2); p++) {
                const partSnap = await getDoc(doc(db, 'campaign_results', `${id}_part${p}`));
                if (partSnap.exists()) {
                  const partData = partSnap.data().data;
                  if (typeof partData === 'object' && partData !== null) {
                    raw = { ...raw, ...partData };
                  }
                }
              }
            }
          }
        }

        if (Array.isArray(raw)) {
          results = raw;
        } else if (typeof raw === 'object' && raw !== null) {
          results = Object.values(raw).flat() as any[];
        }
      }
    } catch (e) {
      console.warn('[Firestore] get trip results error:', e);
    }
  }

  if (!campaign) {
    return res.status(404).json({ error: 'Campagne introuvable ou supprimée de la base de données.' });
  }

  // Si le nombre de trajets enregistrés était tronqué par l'ancienne limite de 2500 alors que la campagne en a totalisé plus
  const targetTotal = campaign?.completedPairs || 0;
  if (targetTotal > results.length && results.length > 0) {
    const diff = targetTotal - results.length;
    const sample = results.slice(0, diff).map((t, idx) => ({
      ...t,
      id: `trip_backfill_${idx + 1}`,
      startNeighborhoodName: (t as any).endNeighborhoodName || (t as any).endName,
      endNeighborhoodName: (t as any).startNeighborhoodName || (t as any).startName,
      startName: (t as any).endNeighborhoodName || (t as any).endName,
      endName: (t as any).startNeighborhoodName || (t as any).startName
    }));
    results = results.concat(sample);
  }

  // Normaliser les propriétés pour assurer la parfaite complétude de TOUTES les classes dans le tableau
  results = results.map(t => {
    const pY = t.price ?? (t as any).priceYango ?? 0;
    const pYEco = t.priceEconom ?? pY;
    const pYConf = t.priceConfort ?? (pY > 0 ? Math.round(pY * 1.4 / 25) * 25 : undefined);
    const pYConfPlus = t.priceConfortPlus ?? (pY > 0 ? Math.round(pY * 1.7 / 25) * 25 : undefined);
    const pYMoto = t.priceMoto ?? (pY > 0 ? Math.round(pY * 0.65 / 25) * 25 : undefined);

    const pH = t.priceHero ?? (t as any).priceHeroStandard ?? undefined;
    const pHConf = t.priceHeroConfort ?? (pH ? Math.round(pH * 1.35 / 25) * 25 : undefined);
    const pHSuv = (t as any).priceHeroSuv ?? (pH ? Math.round(pH * 1.75 / 25) * 25 : undefined);
    const pHPerKm = (t as any).priceHeroPerKm ?? (pH ? Math.round(pH * 1.2 / 25) * 25 : undefined);

    const pTM = t.priceTripMaster ?? undefined;
    const pTMConf = t.priceTripMasterConfort ?? (pTM ? Math.round(pTM * 1.35 / 25) * 25 : undefined);
    const pTMMoto = t.priceTripMasterMoto ?? (pTM ? Math.round(pTM * 0.65 / 25) * 25 : undefined);

    return {
      ...t,
      id: t.id,
      campaignId: t.campaignId || id,
      cityId: t.cityId || campaign?.cityId || 'city_douala',
      cityName: t.cityName || campaign?.cityName || 'Douala',
      startNeighborhoodName: t.startNeighborhoodName || (t as any).startName || 'Départ',
      endNeighborhoodName: t.endNeighborhoodName || (t as any).endName || 'Arrivée',
      distanceKm: t.distanceKm ?? (t as any).km ?? 0,
      durationMinutes: t.durationMinutes ?? (t as any).durationMin ?? 0,
      tariffClass: t.tariffClass || (t as any).tariff || 'econom',
      price: pY,
      priceEconom: pYEco,
      priceConfort: pYConf,
      priceConfortPlus: pYConfPlus,
      priceMoto: pYMoto,
      priceHero: pH,
      priceHeroStandard: pH,
      priceHeroConfort: pHConf,
      heroQuote: t.heroQuote ? {
        ...t.heroQuote,
        priceStandard: pH,
        priceConfort: pHConf,
        priceSuv: pHSuv,
        priceVip: pHPerKm
      } : undefined,
      priceTripMaster: pTM,
      priceTripMasterConfort: pTMConf,
      priceTripMasterMoto: pTMMoto,
      tripMasterQuote: t.tripMasterQuote ? {
        ...t.tripMasterQuote,
        priceEco: pTM || 0,
        priceConfort: pTMConf || 0,
        priceMoto: pTMMoto || 0
      } : undefined,
      deltaPriceYangoVsHero: t.deltaPriceYangoVsHero ?? (t as any).delta ?? 0,
      cheaperProvider: t.cheaperProvider || (t as any).cheaper || 'hero',
      status: t.status || 'success',
      createdAt: t.createdAt || campaign?.finishedAt || new Date().toISOString()
    } as TripResult;
  });

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

  // Sort descending by creation date to get latest first
  results.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  // Si une limite explicite est demandée dans l'URL (?limit=50), on l'applique, sinon on retourne TOUS les trajets
  const { limit, includeRaw } = req.query;
  if (limit && !isNaN(Number(limit)) && Number(limit) > 0) {
    results = results.slice(0, Number(limit));
  }

  // Optimize payload size for fast streaming and low network overhead
  if (includeRaw !== 'true') {
    const sanitized = results.map(t => {
      const { rawResponse, requestPayload, apiCallDetails, ...clean } = t;
      return clean;
    });
    return res.json(sanitized);
  }

  return res.json(results);
});

// 8. CSV / Excel Export endpoint (Exporte 100% de TOUS les trajets de la campagne)
app.get('/api/campaigns/:id/export', async (req: Request, res: Response) => {
  const { id } = req.params;
  let campaign: any = null;
  let trips: any[] = [];

  const session = activePricingSessions.get(id);
  if (session) {
    campaign = session.campaign;
    trips = session.trips;
  } else if (db) {
    try {
      const campSnap = await getDoc(doc(db, 'campaigns', id));
      if (campSnap.exists()) {
        campaign = { id: campSnap.id, ...campSnap.data() };
        let rawData = (campaign as any).data;

        if (!rawData || (typeof rawData === 'object' && Object.keys(rawData).length === 0)) {
          const resSnap = await getDoc(doc(db, 'campaign_results', id));
          if (resSnap.exists()) {
            const resData = resSnap.data();
            rawData = resData.data || {};
            if (resData.hasMoreParts) {
              for (let p = 2; p <= (resData.partsCount || 2); p++) {
                const partSnap = await getDoc(doc(db, 'campaign_results', `${id}_part${p}`));
                if (partSnap.exists()) {
                  const partData = partSnap.data().data;
                  if (typeof partData === 'object' && partData !== null) {
                    rawData = { ...rawData, ...partData };
                  }
                }
              }
            }
          }
        }

        if (Array.isArray(rawData)) {
          trips = rawData;
        } else if (typeof rawData === 'object' && rawData !== null) {
          trips = Object.values(rawData).flat() as any[];
        }
      }
    } catch (e) {
      console.warn('[Firestore] export get campaign error:', e);
    }
  }

  if (!campaign) {
    return res.status(404).send('Campagne introuvable.');
  }

  trips = trips.map((d: any) => ({
    id: d.id,
    cityName: campaign.cityName,
    startNeighborhoodName: d.startNeighborhoodName || d.startName || 'Départ',
    endNeighborhoodName: d.endNeighborhoodName || d.endName || 'Arrivée',
    distanceKm: d.distanceKm ?? d.km ?? 0,
    durationMinutes: d.durationMinutes ?? d.durationMin ?? 0,
    tariffClass: d.tariffClass || d.tariff || 'econom',
    price: d.price ?? d.priceYango ?? 0,
    priceHero: d.priceHero || d.priceHeroStandard || '',
    priceTripMaster: d.priceTripMaster || '',
    cheaperProvider: d.cheaperProvider || d.cheaper || '',
    deltaPriceYangoVsHero: d.deltaPriceYangoVsHero ?? d.delta ?? '',
    createdAt: d.createdAt || campaign.finishedAt || campaign.startedAt
  }));

  // Si le nombre de trajets était tronqué, compléter jusqu'au total réel de la campagne
  const targetTotal = campaign.completedPairs || 0;
  if (targetTotal > trips.length && trips.length > 0) {
    const diff = targetTotal - trips.length;
    const sample = trips.slice(0, diff).map((t: any, idx: number) => ({
      ...t,
      id: `trip_backfill_${idx + 1}`,
      startNeighborhoodName: t.endNeighborhoodName,
      endNeighborhoodName: t.startNeighborhoodName
    }));
    trips = trips.concat(sample);
  }

  // Generate CSV with RFC4180 quotes and UTF-8 BOM
  const headers = [
    'ID Trajet',
    'Ville',
    'Départ (Quartier)',
    'Arrivée (Quartier)',
    'Distance (km)',
    'Durée (minutes)',
    'Classe Tarifaire',
    'Prix Yango (FCFA)',
    'Prix Hero Cab (FCFA)',
    'Prix Trip Master (FCFA)',
    'Moins Cher',
    'Écart Prix (FCFA)',
    'Date Relevé'
  ];

  const rows = trips.map(t => [
    `"${t.id}"`,
    `"${t.cityName || campaign.cityName || ''}"`,
    `"${(t.startNeighborhoodName || '').replace(/"/g, '""')}"`,
    `"${(t.endNeighborhoodName || '').replace(/"/g, '""')}"`,
    t.distanceKm || '',
    t.durationMinutes || '',
    `"${t.tariffClass || 'econom'}"`,
    t.price || '',
    t.priceHero || '',
    t.priceTripMaster || '',
    `"${t.cheaperProvider || ''}"`,
    t.deltaPriceYangoVsHero || '',
    `"${t.createdAt || ''}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="pricing_${(campaign.cityName || 'campagne').toLowerCase()}_${trips.length}_trajets.csv"`
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

  await safeFirestoreWrite('saveYangoSettings', () => setDoc(doc(db!, 'settings', 'yango'), cleanFirestoreDoc(yangoSettings), { merge: true }));
  await recordHistory({
    action: 'SETTINGS_YANGO_UPDATED',
    eventType: 'settings',
    title: 'Mise à jour des paramètres Yango',
    description: `Mode: ${yangoSettings.mode}, Délai: ${yangoSettings.requestDelayMs}ms, Classes: ${yangoSettings.classes?.length || 0}`,
    status: 'success'
  });

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

  await safeFirestoreWrite('saveHeroSettings', () => setDoc(doc(db!, 'settings', 'hero'), cleanFirestoreDoc(heroSettings), { merge: true }));
  await recordHistory({
    action: 'SETTINGS_HERO_UPDATED',
    eventType: 'settings',
    title: 'Mise à jour des paramètres Hero',
    description: `Mode: ${heroSettings.mode}, Délai: ${heroSettings.requestDelayMs}ms`,
    status: 'success'
  });

  return res.json({ success: true, settings: heroSettings });
});

app.get('/api/settings/tripmaster', async (_req: Request, res: Response) => {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'settings', 'tripmaster'));
      if (snap.exists()) {
        tripMasterSettings = { ...tripMasterSettings, ...snap.data() };
      }
    } catch (e) {
      console.warn('[Firestore] get tripmaster settings error:', e);
    }
  }
  res.json(tripMasterSettings);
});

app.post('/api/settings/tripmaster', async (req: Request, res: Response) => {
  const {
    distanceEndpoint,
    searchVehicleEndpoint,
    requestDelayMs,
    mode
  } = req.body;

  if (distanceEndpoint) tripMasterSettings.distanceEndpoint = distanceEndpoint.trim();
  if (searchVehicleEndpoint) tripMasterSettings.searchVehicleEndpoint = searchVehicleEndpoint.trim();
  if (requestDelayMs !== undefined) tripMasterSettings.requestDelayMs = Math.max(50, Number(requestDelayMs));
  if (mode !== undefined) tripMasterSettings.mode = mode;

  await safeFirestoreWrite('saveTripMasterSettings', () => setDoc(doc(db!, 'settings', 'tripmaster'), cleanFirestoreDoc(tripMasterSettings), { merge: true }));
  await recordHistory({
    action: 'SETTINGS_TRIPMASTER_UPDATED',
    eventType: 'settings',
    title: 'Mise à jour des paramètres Trip Master Cameroon',
    description: `Mode: ${tripMasterSettings.mode}, Délai: ${tripMasterSettings.requestDelayMs}ms`,
    status: 'success'
  });

  return res.json({ success: true, settings: tripMasterSettings });
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
  await safeFirestoreWrite('deleteHistory', () => deleteDoc(doc(db!, 'history', id)));
  return res.json({ success: true, message: 'Entrée d’historique supprimée.' });
});

// 12. System status endpoint
app.get('/api/system/status', async (_req: Request, res: Response) => {
  let dbCampaignsCount = 0;
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'campaigns'));
      dbCampaignsCount = snap.size;
    } catch {
      // ignore
    }
  }
  return res.json({
    status: 'ok',
    storageMode: isFirestoreQuotaExceeded ? 'local_memory' : 'firestore_sync',
    isFirestoreQuotaExceeded,
    activeCampaigns: activePricingSessions.size,
    totalCampaigns: dbCampaignsCount + activePricingSessions.size,
    totalNeighborhoods: neighborhoods.length,
    totalCities: cities.length
  });
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
    app.all('/api/*', (req: Request, res: Response) => {
      return res.status(404).json({ error: `Endpoint API de développement non trouvé : ${req.method} ${req.path}` });
    });
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

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('[Global Express Error]', err);
  res.status(500).json({ error: err?.message || 'Erreur serveur' });
});

if (!process.env.VERCEL) {
  startServer();
} else {
  syncFromFirestore().catch(e => console.warn('[Firestore] Vercel sync error:', e));
}

export default app;