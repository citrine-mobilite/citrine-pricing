import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { CanonicalTrip } from '../types.js';

let db: Firestore | null = null;

try {
  let firebaseConfig: any = null;
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');

  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else if (process.env.FIREBASE_CONFIG) {
    firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
  }

  if (firebaseConfig) {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    console.log('[Firestore] Connecté avec succès à la base Firestore:', firebaseConfig.firestoreDatabaseId || 'default');
  } else {
    console.warn('[Firestore] Aucune configuration Firebase trouvée. Mode in-memory activé.');
  }
} catch (e: any) {
  console.warn('[Firestore] Erreur d’initialisation Firebase:', e.message);
}

export { db };

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
 */
export async function safeFirestoreWrite<T>(opName: string, op: () => Promise<T>): Promise<T | null> {
  if (!db) return null;
  try {
    return await op();
  } catch (err: any) {
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
 * Stockage partitionné garanti < 500 Ko pour respecter strictly la limite Firestore de 1 Mo
 * Chaque document est plafonné à 1 000 trajets canoniques maximum (~280 Ko).
 */
export async function saveCanonicalCampaignResults(
  campaignId: string,
  cityName: string,
  canonicalTrips: CanonicalTrip[]
): Promise<void> {
  if (!db) return;

  const CHUNK_SIZE = 1000; // ~280 Ko par chunk, largement sous la limite de 1 048 576 octets
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

  console.log(`[Firestore] ${canonicalTrips.length} trajets canoniques stockés en ${totalChunks} partie(s) (< 400 Ko par doc).`);
}

/**
 * Chargement et recombinaison de tous les fragments d'une campagne
 */
export async function loadCanonicalCampaignResults(campaignId: string): Promise<CanonicalTrip[]> {
  if (!db) return [];

  try {
    const firstSnap = await getDoc(doc(db, 'campaign_results', campaignId));
    if (!firstSnap.exists()) return [];

    const firstData = firstSnap.data();
    let allTrips: CanonicalTrip[] = [];

    if (Array.isArray(firstData.canonicalTrips)) {
      allTrips = allTrips.concat(firstData.canonicalTrips);
    } else if (firstData.data && typeof firstData.data === 'object') {
      // Rétrocompatibilité avec les anciennes campagnes partitionnées par worker
      const rawWorkers = Object.values(firstData.data).flat() as any[];
      allTrips = rawWorkers.map(legacyToCanonical);
    }

    if (firstData.hasMoreParts && firstData.totalParts > 1) {
      for (let p = 2; p <= firstData.totalParts; p++) {
        const partSnap = await getDoc(doc(db, 'campaign_results', `${campaignId}_part${p}`));
        if (partSnap.exists()) {
          const partData = partSnap.data();
          if (Array.isArray(partData.canonicalTrips)) {
            allTrips = allTrips.concat(partData.canonicalTrips);
          } else if (partData.data) {
            const rawWorkers = Object.values(partData.data).flat() as any[];
            allTrips = allTrips.concat(rawWorkers.map(legacyToCanonical));
          }
        }
      }
    }

    return allTrips;
  } catch (err: any) {
    console.error(`[Firestore] Erreur de lecture des résultats canoniques pour ${campaignId}:`, err.message);
    return [];
  }
}

/**
 * Conversion rétrocompatible d'anciens enregistrements vers le format canonique
 */
function legacyToCanonical(t: any): CanonicalTrip {
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
