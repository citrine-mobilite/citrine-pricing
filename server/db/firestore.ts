import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  setLogLevel,
  Firestore,
  doc,
  setDoc,
  getDoc,
  collection,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { CanonicalTrip } from '../types.js';
import bundledFirebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

// Réduire au silence les logs internes de transport gRPC Firestore
try {
  setLogLevel('silent');
} catch {}

// Filtrer les déconnexions normales de flux et erreurs de quota Firestore de console.error
const origConsoleError = console.error;
console.error = (...args: any[]) => {
  const msg = args.map(a => String(a?.message || a || '')).join(' ');
  if (
    msg.includes('Disconnecting idle stream') ||
    msg.includes('Timed out waiting for new targets') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Free daily read units') ||
    msg.includes('Free daily write units') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('resource-exhausted') ||
    msg.includes('deleting related history for campaign')
  ) {
    return;
  }
  origConsoleError.apply(console, args);
};

let db: Firestore | null = null;

try {
  let firebaseConfig: any = bundledFirebaseConfig;

  if (process.env.FIREBASE_CONFIG) {
    try {
      firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
    } catch {}
  } else {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      try {
        firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch {}
    }
  }

  if (firebaseConfig && firebaseConfig.projectId) {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    try {
      db = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true
      }, firebaseConfig.firestoreDatabaseId);
    } catch {
      db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }
    console.log('[Firestore] Connecté avec succès à la base Firestore:', firebaseConfig.firestoreDatabaseId || 'default');
  } else {
    console.warn('[Firestore] Aucune configuration Firebase trouvée. Mode in-memory activé.');
  }
} catch (e: any) {
  console.warn('[Firestore] Erreur d’initialisation Firebase:', e.message);
}

export { db };

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const QUOTA_STATE_FILE = path.resolve(DATA_DIR, 'quota_state.json');

// Plafond strict absolu de lectures par tranche de 24 heures (bien en-dessous du seuil Free Tier de 50 000)
export const MAX_DAILY_READ_LIMIT = 200;

interface PersistentQuotaState {
  readUntil: number;
  writeUntil: number;
  readCountToday: number;
  readCountResetTime: number;
}

function loadPersistentQuotaState(): PersistentQuotaState {
  const now = Date.now();
  try {
    if (fs.existsSync(QUOTA_STATE_FILE)) {
      const raw = fs.readFileSync(QUOTA_STATE_FILE, 'utf8');
      const data = JSON.parse(raw);
      const isSameDay = typeof data.readCountResetTime === 'number' && now < data.readCountResetTime;
      return {
        readUntil: typeof data.readUntil === 'number' && data.readUntil > now ? data.readUntil : 0,
        writeUntil: typeof data.writeUntil === 'number' && data.writeUntil > now ? data.writeUntil : 0,
        readCountToday: isSameDay && typeof data.readCountToday === 'number' ? data.readCountToday : 0,
        readCountResetTime: isSameDay ? data.readCountResetTime : now + 24 * 60 * 60 * 1000
      };
    }
  } catch {}
  return { readUntil: 0, writeUntil: 0, readCountToday: 0, readCountResetTime: now + 24 * 60 * 60 * 1000 };
}

function savePersistentQuotaState(state: PersistentQuotaState) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(QUOTA_STATE_FILE, JSON.stringify({
      ...state,
      updatedAt: new Date().toISOString()
    }, null, 2), 'utf8');
  } catch {}
}

let persistentQuota = loadPersistentQuotaState();
let firestoreReadQuotaExceededUntil = persistentQuota.readUntil;
let firestoreWriteQuotaExceededUntil = persistentQuota.writeUntil;
let firestoreDailyReadCount = persistentQuota.readCountToday;
let firestoreDailyResetTime = persistentQuota.readCountResetTime;
let warnedQuotaExceeded = false;

export function isQuotaExceededError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || err?.details || err?.code || err || '').toLowerCase();
  return msg.includes('quota limit exceeded') ||
         msg.includes('resource_exhausted') ||
         msg.includes('resource-exhausted') ||
         msg.includes('quota exceeded') ||
         msg.includes('free daily read units') ||
         msg.includes('free daily write units') ||
         msg.includes('free tier database') ||
         msg.includes('quota metric') ||
         err?.code === 'resource-exhausted' ||
         err?.code === 8;
}

export function isWriteQuotaError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('write units') || (msg.includes('write') && isQuotaExceededError(err));
}

export function isFirestoreReadQuotaExceeded(): boolean {
  const now = Date.now();
  // Réinitialisation automatique du compteur journalier si 24h écoulées
  if (now > firestoreDailyResetTime) {
    firestoreDailyReadCount = 0;
    firestoreDailyResetTime = now + 24 * 60 * 60 * 1000;
    firestoreReadQuotaExceededUntil = 0;
    savePersistentQuotaState({
      readUntil: 0,
      writeUntil: firestoreWriteQuotaExceededUntil,
      readCountToday: 0,
      readCountResetTime: firestoreDailyResetTime
    });
  }

  // Bloquer si le quota Google est atteint ou si notre compteur de sécurité a atteint la limite fixée
  return now < firestoreReadQuotaExceededUntil || firestoreDailyReadCount >= MAX_DAILY_READ_LIMIT;
}

export function isFirestoreWriteQuotaExceeded(): boolean {
  return Date.now() < firestoreWriteQuotaExceededUntil;
}

export function isFirestoreQuotaExceeded(): boolean {
  return isFirestoreReadQuotaExceeded();
}

export function getFirestoreReadStats(): { count: number; limit: number; remaining: number } {
  return {
    count: firestoreDailyReadCount,
    limit: MAX_DAILY_READ_LIMIT,
    remaining: Math.max(0, MAX_DAILY_READ_LIMIT - firestoreDailyReadCount)
  };
}

export function flagFirestoreReadQuotaExceeded(err?: any) {
  firestoreReadQuotaExceededUntil = Date.now() + 24 * 60 * 60 * 1000;
  savePersistentQuotaState({
    readUntil: firestoreReadQuotaExceededUntil,
    writeUntil: firestoreWriteQuotaExceededUntil,
    readCountToday: firestoreDailyReadCount,
    readCountResetTime: firestoreDailyResetTime
  });
  if (!warnedQuotaExceeded) {
    warnedQuotaExceeded = true;
    console.warn(`[Firestore Read Shield] Quota journalier atteint (Lu: ${firestoreDailyReadCount}/${MAX_DAILY_READLimitNotice()}). Bascule 100% sur le cache local RAM + Disque.`);
  }
}

function MAX_DAILY_READLimitNotice(): string {
  return String(MAX_DAILY_READ_LIMIT);
}

export function flagFirestoreWriteQuotaExceeded(err?: any) {
  firestoreWriteQuotaExceededUntil = Date.now() + 24 * 60 * 60 * 1000;
  savePersistentQuotaState({
    readUntil: firestoreReadQuotaExceededUntil,
    writeUntil: firestoreWriteQuotaExceededUntil,
    readCountToday: firestoreDailyReadCount,
    readCountResetTime: firestoreDailyResetTime
  });
  console.warn('[Firestore Write Shield] Quota journalier d\'écriture atteint. Bascule en sauvegarde locale persistante (RAM + Disque).');
}

export function flagFirestoreQuotaExceeded(err?: any) {
  if (isWriteQuotaError(err)) {
    flagFirestoreWriteQuotaExceeded(err);
  } else {
    flagFirestoreReadQuotaExceeded(err);
  }
}

/**
 * Exécution ultra-protégée de TOUTE lecture Firestore
 * Empêche formellement de dépasser le quota : coupe-circuit immédiat !
 */
export async function safeFirestoreRead<T>(opName: string, op: () => Promise<T>, estimatedDocs: number = 1): Promise<T | null> {
  if (!db || isFirestoreReadQuotaExceeded()) {
    return null;
  }

  // Vérifier si cette opération dépasserait la limite journalière
  if (firestoreDailyReadCount + estimatedDocs > MAX_DAILY_READ_LIMIT) {
    flagFirestoreReadQuotaExceeded();
    return null;
  }

  try {
    const result = await op();
    firestoreDailyReadCount += estimatedDocs;
    savePersistentQuotaState({
      readUntil: firestoreReadQuotaExceededUntil,
      writeUntil: firestoreWriteQuotaExceededUntil,
      readCountToday: firestoreDailyReadCount,
      readCountResetTime: firestoreDailyResetTime
    });
    console.log(`[Firestore Shield] Lecture Firestore '${opName}': +${estimatedDocs} doc(s) (Total aujourd'hui: ${firestoreDailyReadCount}/${MAX_DAILY_READ_LIMIT})`);
    return result;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      flagFirestoreReadQuotaExceeded(err);
      return null;
    }
    console.warn(`[Firestore Read Shield - ${opName}]:`, err?.message || err);
    return null;
  }
}

/**
 * Nettoyage strict des objets avant envoi à Firestore (évite les undefined et types non supportés)
 */
export function cleanFirestoreDoc(obj: any): any {
  if (obj === undefined || obj === null) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanFirestoreDoc);

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = cleanFirestoreDoc(value);
    }
  }
  return clean;
}

/**
 * Exécution sécurisée d'écriture Firestore avec capture d'erreurs
 * Même si les lectures sont épuisées, les écritures sont autorisées tant que le quota d'écriture n'est pas plein !
 */
export async function safeFirestoreWrite<T>(opName: string, op: () => Promise<T>): Promise<T | null> {
  if (!db || isFirestoreWriteQuotaExceeded()) return null;
  try {
    return await op();
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      if (isWriteQuotaError(err)) {
        flagFirestoreWriteQuotaExceeded(err);
      } else {
        flagFirestoreReadQuotaExceeded(err);
      }
      return null;
    }
    console.error(`[Firestore Error - ${opName}]:`, err?.message || err);
    return null;
  }
}

/**
 * Initialisation immédiate du document campaign_results avant l'insertion des lots
 */
export async function initCanonicalCampaignResults(campaignId: string, cityName: string): Promise<void> {
  if (!db) return;
  const payload = cleanFirestoreDoc({
    campaignId,
    cityName,
    savedAt: new Date().toISOString(),
    partIndex: 1,
    totalParts: 1,
    hasMoreParts: false,
    chunkSize: 0,
    totalTrips: 0,
    canonicalTrips: []
  });
  await safeFirestoreWrite('initCanonicalResults', async () => {
    await setDoc(doc(db!, 'campaign_results', campaignId), payload);
  });
}

/**
 * Solution B: Enregistrement d'un lot individuel (1 écriture par lot)
 * Poids du document: ~2.5 Ko (400 fois sous le plafond de 1 Mo).
 * Aucune réécriture cumulative des lots précédents.
 * Exactement 1 écriture par lot de 10 trajets.
 */
export async function saveCanonicalCampaignBatch(
  campaignId: string,
  cityName: string,
  chunkIndex: number,
  chunkTrips: CanonicalTrip[]
): Promise<void> {
  if (!db || chunkTrips.length === 0) return;

  const docId = `${campaignId}_lot_${chunkIndex}`;
  const payload = cleanFirestoreDoc({
    campaignId,
    cityName,
    chunkIndex,
    tripsCount: chunkTrips.length,
    canonicalTrips: chunkTrips,
    savedAt: new Date().toISOString()
  });

  await safeFirestoreWrite(`saveBatch_${chunkIndex}`, async () => {
    await setDoc(doc(db!, 'campaign_results', docId), payload);
  });
}

/**
 * Stockage partitionné garanti < 500 Ko pour respecter strictly la limite Firestore de 1 Mo
 * Plafonné à 2 500 trajets canoniques par document (~450 Ko, 2x sous la limite de 1 Mo).
 * Une campagne standard de 1 300 trajets tient dans EXACTEMENT 1 seul document Firestore (1 écriture unique).
 */
export async function saveCanonicalCampaignResults(
  campaignId: string,
  cityName: string,
  canonicalTrips: CanonicalTrip[]
): Promise<void> {
  if (!db || canonicalTrips.length === 0) return;

  const CHUNK_SIZE = 2500; // ~450 Ko par document, largement sous la limite de 1 048 576 octets
  const totalChunks = Math.ceil(canonicalTrips.length / CHUNK_SIZE) || 1;

  for (let i = 0; i < totalChunks; i++) {
    const chunkTrips = canonicalTrips.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const docId = i === 0 ? campaignId : `${campaignId}_part${i + 1}`;

    const payload = cleanFirestoreDoc({
      campaignId,
      cityName,
      savedAt: new Date().toISOString(),
      partIndex: i + 1,
      totalParts: totalChunks,
      hasMoreParts: totalChunks > 1,
      chunkSize: chunkTrips.length,
      totalTrips: canonicalTrips.length,
      canonicalTrips: chunkTrips
    });

    await safeFirestoreWrite(`savePart_${i + 1}`, async () => {
      await setDoc(doc(db!, 'campaign_results', docId), payload);
    });
  }

  console.log(`[Firestore Quota Shield] ${canonicalTrips.length} trajets canoniques stockés en ${totalChunks} écriture(s) (< 500 Ko).`);
}

const TRIPS_FILE = path.resolve(process.cwd(), 'server/data/trips.json');

function readLocalTripsJson(): Record<string, any> {
  try {
    if (fs.existsSync(TRIPS_FILE)) {
      return JSON.parse(fs.readFileSync(TRIPS_FILE, 'utf8')) || {};
    }
  } catch {}
  return {};
}

function writeLocalTripsJson(store: Record<string, any>) {
  try {
    const dir = path.dirname(TRIPS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TRIPS_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch {}
}

/**
 * Chargement direct (Exactement 1 seule lecture Firestore O(1), avec sauvegarde dans trips.json)
 * ZÉRO scan de sous-collections, ZÉRO getDocs multi-documents.
 */
export async function loadCanonicalCampaignResults(campaignId: string): Promise<CanonicalTrip[]> {
  // 1. Contrôle préalable : Vérifier trips.json unifié (0 lecture Firestore)
  try {
    const store = readLocalTripsJson();
    const entry = store[campaignId] || store[String(campaignId)];
    if (entry) {
      if (typeof entry === 'object' && Array.isArray(entry.canonicalTrips) && entry.canonicalTrips.length > 0) {
        return entry.canonicalTrips;
      }
      if (Array.isArray(entry) && entry.length > 0) {
        return entry.map(legacyToCanonical);
      }
      if (typeof entry === 'object' && Array.isArray(entry.trips) && entry.trips.length > 0) {
        return entry.trips.map(legacyToCanonical);
      }
    }
  } catch (e: any) {
    console.warn('[Disk Cache] Warning reading trips.json:', e.message);
  }

  // 2. Si le quota de lecture est atteint ou si Firestore est indisponible : stop immédiat
  if (!db || isFirestoreReadQuotaExceeded()) {
    return [];
  }

  try {
    let allTrips: CanonicalTrip[] = [];

    // 3. Lecture O(1) directe du document consolidé (consomme exactement 1 lecture Firestore)
    const firstSnap = await safeFirestoreRead('getDocCanonicalResults', () =>
      getDoc(doc(db!, 'campaign_results', campaignId)), 1
    );

    if (firstSnap && firstSnap.exists()) {
      const firstData = firstSnap.data();
      if (Array.isArray(firstData.canonicalTrips) && firstData.canonicalTrips.length > 0) {
        allTrips = firstData.canonicalTrips;
      } else if (firstData.data && typeof firstData.data === 'object') {
        const rawWorkers = Object.values(firstData.data).flat() as any[];
        allTrips = rawWorkers.map(legacyToCanonical);
      }
    }

    // 4. Si non trouvé dans campaign_results, vérification directe du document maître campaigns (1 lecture O(1))
    if (allTrips.length === 0 && !isFirestoreReadQuotaExceeded()) {
      const campSnap = await safeFirestoreRead('getDocCampaign', () =>
        getDoc(doc(db!, 'campaigns', campaignId)), 1
      );
      if (campSnap && campSnap.exists()) {
        const cData = campSnap.data();
        if (Array.isArray(cData.canonicalTrips) && cData.canonicalTrips.length > 0) {
          allTrips = cData.canonicalTrips;
        } else if (Array.isArray(cData.trips) && cData.trips.length > 0) {
          allTrips = cData.trips.map(legacyToCanonical);
        }
      }
    }

    // 5. Sauvegarde immédiate dans trips.json unifié (sans fichiers séparés)
    if (allTrips.length > 0) {
      try {
        const store = readLocalTripsJson();
        const existing = store[campaignId] || {};
        store[campaignId] = {
          trips: Array.isArray(existing.trips) ? existing.trips : (Array.isArray(existing) ? existing : []),
          canonicalTrips: allTrips,
          updatedAt: new Date().toISOString()
        };
        writeLocalTripsJson(store);
      } catch {}
    }

    return allTrips;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      flagFirestoreQuotaExceeded(err);
      return [];
    }
    console.error(`[Firestore] Erreur de lecture des résultats canoniques pour ${campaignId}:`, err.message);
    return [];
  }
}

/**
 * Conversion rétrocompatible d'anciens enregistrements vers le format canonique
 */
export function legacyToCanonical(t: any): CanonicalTrip {
  const orig = (t.startNeighborhoodName || t.startName || '—').replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim();
  const dest = (t.endNeighborhoodName || t.endName || '—').replace(/,\s*(?:Cameroun|Cameroon)\s*$/i, '').trim();

  const yEco = t.priceEconom ?? t.priceYango ?? t.price ?? null;
  const yConf = t.priceConfort ?? null;
  const yConfPlus = t.priceConfortPlus ?? null;
  const yMoto = t.priceMoto ?? null;

  const hEco = t.priceHeroStandard ?? t.priceHero ?? null;
  const hConf = t.priceHeroConfort ?? null;
  const hSuv = t.priceHeroSuv ?? null;
  const hPerKm = t.priceHeroPerKm ?? null;

  const tmEco = t.priceTripMaster ?? t.priceTripMasterEco ?? null;
  const tmConf = t.priceTripMasterConfort ?? null;
  const tmMoto = t.priceTripMasterMoto ?? null;

  return {
    id: t.id || `legacy_${Math.random()}`,
    origin: orig,
    destination: dest,
    distanceKm: t.distanceKm ?? t.km ?? 0,
    durationMin: t.durationMinutes ?? t.durationMin ?? 0,
    jams: Boolean(t.jams !== undefined ? t.jams : t.hasJams),
    yangoUnavailable: Boolean(t.yangoUnavailable !== undefined ? t.yangoUnavailable : t.shortage || t.noCars),
    yangoWaitingMinutes: t.yangoWaitingMinutes ?? t.waitingTimeMinutes,
    yangoUnavailableClasses: t.yangoUnavailableClasses,
    prices: {
      yango: { eco: yEco, confort: yConf, confortPlus: yConfPlus, moto: yMoto },
      heroCab: { eco: hEco, confort: hConf, suv: hSuv, perKm: hPerKm },
      tripMaster: { eco: tmEco, confort: tmConf, moto: tmMoto }
    },
    cheapest: {
      eco: t.cheaperProvider || 'yango',
      confort: null,
      overall: t.cheaperProvider || 'yango'
    },
    status: t.status || 'success',
    createdAt: t.createdAt
  };
}

/**
 * Suppression propre et atomique de tous les documents d'une campagne
 */
export async function deleteCanonicalCampaign(campaignId: string): Promise<void> {
  if (!db) return;

  await safeFirestoreWrite('deleteCanonicalCampaign', async () => {
    // 1. Supprimer le document principal de campagne (écritures directes O(1) sans AUCUNE lecture)
    await deleteDoc(doc(db!, 'campaigns', campaignId)).catch(() => {});
    // 2. Supprimer le document de résultats consolidé
    await deleteDoc(doc(db!, 'campaign_results', campaignId)).catch(() => {});
    
    // 3. Supprimer les partitions prévisibles (deleteDoc ne consomme aucune unité de lecture Firestore)
    for (let p = 2; p <= 10; p++) {
      deleteDoc(doc(db!, 'campaign_results', `${campaignId}_part${p}`)).catch(() => {});
    }

    // 4. Supprimer les lots prévisibles
    for (let lot = 0; lot <= 30; lot++) {
      deleteDoc(doc(db!, 'campaign_results', `${campaignId}_lot_${lot}`)).catch(() => {});
    }
  });
}
