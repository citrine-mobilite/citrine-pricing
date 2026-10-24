import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { CanonicalTrip, PricingCampaign } from '../types.js';

let dbInstance: any = null;
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    dbInstance = getFirestore(app, config.firestoreDatabaseId || undefined);
    console.log('[Firestore] Connecté avec succès à la base Firestore :', config.firestoreDatabaseId || 'default');
  }
} catch (e: any) {
  console.warn('[Firestore] Initialisation en mode dégradé:', e.message);
}

export const db = dbInstance;
export const MAX_DAILY_READ_LIMIT = 999999;

export function isQuotaExceededError(_err: any): boolean {
  return false;
}

export function isWriteQuotaError(_err: any): boolean {
  return false;
}

export function isFirestoreReadQuotaExceeded(): boolean {
  return false;
}

export function isFirestoreWriteQuotaExceeded(): boolean {
  return false;
}

export function isFirestoreQuotaExceeded(): boolean {
  return false;
}

export function getFirestoreReadStats(): { count: number; limit: number; remaining: number } {
  return { count: 0, limit: MAX_DAILY_READ_LIMIT, remaining: MAX_DAILY_READ_LIMIT };
}

export function flagFirestoreReadQuotaExceeded(_err?: any) {}
export function flagFirestoreWriteQuotaExceeded(_err?: any) {}
export function flagFirestoreQuotaExceeded(_err?: any) {}

export async function safeFirestoreRead<T>(_opName: string, op: () => Promise<T>, _estimatedDocs: number = 1): Promise<T | null> {
  try {
    return await op();
  } catch {
    return null;
  }
}

export function cleanFirestoreDoc(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanFirestoreDoc);

  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      cleaned[k] = cleanFirestoreDoc(v);
    }
  }
  return cleaned;
}

export async function safeFirestoreWrite<T>(_opName: string, op: () => Promise<T>): Promise<T | null> {
  try {
    return await op();
  } catch {
    return null;
  }
}

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const TRIPS_DIR = path.resolve(DATA_DIR, 'trips');

export async function initCanonicalCampaignResults(_campaignId: string, _cityName: string): Promise<void> {
  // Prise en charge locale
}

export async function saveCanonicalCampaignBatch(
  campaignId: string,
  batchIndex: number,
  trips: CanonicalTrip[],
  _cityName: string
): Promise<void> {
  try {
    if (!fs.existsSync(TRIPS_DIR)) fs.mkdirSync(TRIPS_DIR, { recursive: true });
    const batchFile = path.resolve(TRIPS_DIR, `batch_${campaignId}_${batchIndex}.json`);
    fs.writeFileSync(batchFile, JSON.stringify(trips, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[Disk Storage] Warning writing batch:', e.message);
  }
}

export async function saveCanonicalCampaignResults(
  campaignId: string,
  trips: CanonicalTrip[],
  cityName: string
): Promise<void> {
  const cleanId = String(campaignId);
  // 1. Sauvegarde locale disque ultra-rapide (cache L1)
  try {
    if (!fs.existsSync(TRIPS_DIR)) fs.mkdirSync(TRIPS_DIR, { recursive: true });
    const canonFile = path.resolve(TRIPS_DIR, `canonical_${cleanId}.json`);
    fs.writeFileSync(canonFile, JSON.stringify(trips, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[Disk Storage] Warning writing canonical results:', e.message);
  }

  // 2. Sauvegarde dans la base Firestore réelle (persistance cloud L2)
  if (db) {
    try {
      const docRef = doc(db, 'campaign_results', cleanId);
      await setDoc(docRef, {
        campaignId: cleanId,
        cityName: cityName || 'Douala',
        tripsCount: trips.length,
        trips: cleanFirestoreDoc(trips),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log(`[Firestore] ${trips.length} trajets de la campagne ${cleanId} sauvegardés dans Firestore (collection campaign_results).`);
    } catch (fsErr: any) {
      console.warn('[Firestore] Sauvegarde Firestore non bloquante :', fsErr.message);
    }
  }
}

export async function saveCampaignToFirestore(campaign: PricingCampaign): Promise<void> {
  if (!db || !campaign) return;
  try {
    const docId = String(campaign.uuid || campaign.id);
    const docRef = doc(db, 'campaigns', docId);
    await setDoc(docRef, cleanFirestoreDoc(campaign), { merge: true });
    console.log(`[Firestore] Campagne #${campaign.id} (${campaign.cityName}) persistée dans Firestore.`);
  } catch (e: any) {
    console.warn('[Firestore] Erreur écriture campagne:', e.message);
  }
}

export async function loadCanonicalCampaignResults(campaignId: string): Promise<CanonicalTrip[]> {
  const cleanId = String(campaignId);
  // 1. Lecture cache L1 disque
  try {
    const canonFile = path.resolve(TRIPS_DIR, `canonical_${cleanId}.json`);
    if (fs.existsSync(canonFile)) {
      const raw = fs.readFileSync(canonFile, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e: any) {
    console.warn('[Disk Storage] Warning reading canonical results:', e.message);
  }

  // 2. Lecture depuis Firestore L2 si absent du disque
  if (db) {
    try {
      const docRef = doc(db, 'campaign_results', cleanId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const d = snap.data();
        if (Array.isArray(d?.trips)) return d.trips as CanonicalTrip[];
      }
    } catch (fsErr: any) {
      console.warn('[Firestore] Erreur lecture campaign_results:', fsErr.message);
    }
  }

  return [];
}

export async function deleteCanonicalCampaign(campaignId: string): Promise<void> {
  const cleanId = String(campaignId);
  try {
    const canonFile = path.resolve(TRIPS_DIR, `canonical_${cleanId}.json`);
    if (fs.existsSync(canonFile)) fs.unlinkSync(canonFile);
  } catch {}

  if (db) {
    try {
      await deleteDoc(doc(db, 'campaign_results', cleanId));
      await deleteDoc(doc(db, 'campaigns', cleanId));
    } catch {}
  }
}
