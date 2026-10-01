import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { CanonicalTrip } from '../types.js';
import bundledFirebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

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

/**
 * Chargement direct (1 seule lecture Firestore pour récupérer l'intégralité des trajets de la campagne)
 */
export async function loadCanonicalCampaignResults(campaignId: string): Promise<CanonicalTrip[]> {
  if (!db) return [];

  try {
    let allTrips: CanonicalTrip[] = [];

    // 1. Recherche directe ultra-rapide par ID de document (1 seule lecture directe O(1))
    const firstSnap = await getDoc(doc(db, 'campaign_results', campaignId));
    if (firstSnap.exists()) {
      const firstData = firstSnap.data();

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

      if (allTrips.length > 0) {
        return allTrips;
      }
    }

    // 2. Rétrocompatibilité avec les anciens lots si le document maître n'existe pas
    try {
      const batchQuery = query(
        collection(db, 'campaign_results'),
        where('campaignId', '==', campaignId)
      );
      const batchSnap = await getDocs(batchQuery);
      if (!batchSnap.empty) {
        const batchDocs = batchSnap.docs.map(d => d.data());
        const pureLots = batchDocs.filter(b => typeof b.chunkIndex === 'number');
        if (pureLots.length > 0) {
          pureLots.sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));
          for (const b of pureLots) {
            if (Array.isArray(b.canonicalTrips)) {
              allTrips.push(...b.canonicalTrips);
            }
          }
        }
      }
    } catch (e: any) {
      console.warn(`[Firestore] loadCanonicalCampaignResults batch search:`, e?.message);
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

/**
 * Suppression propre et atomique de tous les documents d'une campagne
 */
export async function deleteCanonicalCampaign(campaignId: string): Promise<void> {
  if (!db) return;

  await safeFirestoreWrite('deleteCanonicalCampaign', async () => {
    // 1. Supprimer le document principal de campagne
    await deleteDoc(doc(db!, 'campaigns', campaignId)).catch(() => {});
    // 2. Supprimer le document de résultats consolidé
    await deleteDoc(doc(db!, 'campaign_results', campaignId)).catch(() => {});
    
    // 3. Rechercher et supprimer en un seul batch tous les lots et partitions existants
    try {
      const q = query(collection(db!, 'campaign_results'), where('campaignId', '==', campaignId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db!);
        snap.docs.forEach((d) => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }
    } catch {
      // Ignore if no batches found
    }
  });
}
