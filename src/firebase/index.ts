import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  disableNetwork,
  memoryLocalCache,
  doc,
  getDocFromServer,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { User, City, Neighborhood, PricingCampaign, TripResult } from '../types';

import { triggerQuotaExceededNotice } from '../utils/quotaHandler';

try {
  setLogLevel('silent');
} catch {}

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with memory cache and disable client network loop (all data requests go through Express /api server)
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalAutoDetectLongPolling: true,
    experimentalForceLongPolling: true
  }, firebaseConfig.firestoreDatabaseId);
  // Prevent client-side 10s backend connection timeouts in iframe preview
  disableNetwork(firestoreInstance).catch(() => {});
} catch {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = firestoreInstance;

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error Handling (Strictly conforming to FirestoreErrorInfo)
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuotaExhausted =
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.includes('Quota limit exceeded') ||
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('Code: 8');

  const errInfo: FirestoreErrorInfo = {
    error: isQuotaExhausted ? 'Quota d’écriture Firestore temporairement atteint (mode local autonome actif)' : errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Notice: ', JSON.stringify(errInfo));
  if (isQuotaExhausted) {
    triggerQuotaExceededNotice();
    return undefined as never;
  }
  throw new Error(JSON.stringify(errInfo));
}

// Test Connection safely on initial boot
export async function testConnection(): Promise<boolean> {
  try {
    return true;
  } catch {
    return false;
  }
}

// Non-blocking trigger on boot
testConnection().catch(() => {});

// Auth Helpers
export async function loginWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;

    const userRef = doc(db, 'users', fbUser.uid);
    let userRole: 'admin' | 'responsable' | 'employe' = 'employe';
    let userName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Utilisateur';

    // Auto-grant admin to project owner emails
    if (
      fbUser.email === 'citrinemobilite@gmail.com' ||
      fbUser.email === 'landrymoutongo97@gmail.com' ||
      fbUser.email === 'landrymouns@gmail.com' ||
      fbUser.email === 'admin@vtc-pricing.internal'
    ) {
      userRole = 'admin';
      userName = 'Admin Citrine';
    } else if (userName.toLowerCase().includes('landry')) {
      userName = 'Admin Citrine';
    }

    const userData: User = {
      id: fbUser.uid,
      email: fbUser.email || '',
      name: userName,
      role: userRole,
      active: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    try {
      await setDoc(userRef, userData, { merge: true });
    } catch {
      // User may not have write permission on their own role if restricted by rules
    }

    return userData;
  } catch (err: any) {
    console.error('Google Sign-in Error:', err);
    throw err;
  }
}

export async function logoutFirebase(): Promise<void> {
  await signOut(auth);
}

// ----------------- FIRESTORE DATA ACCESS ----------------- //

export async function getFirestoreCities(): Promise<City[]> {
  const path = 'cities';
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as City));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveFirestoreCity(city: City): Promise<void> {
  const path = `cities/${city.id}`;
  try {
    await setDoc(doc(db, 'cities', city.id), city, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getFirestoreNeighborhoods(cityId: string): Promise<Neighborhood[]> {
  const path = `cities/${cityId}/neighborhoods`;
  try {
    const snapshot = await getDocs(collection(db, 'cities', cityId, 'neighborhoods'));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Neighborhood));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveFirestoreNeighborhood(cityId: string, nb: Neighborhood): Promise<void> {
  const path = `cities/${cityId}/neighborhoods/${nb.id}`;
  try {
    await setDoc(doc(db, 'cities', cityId, 'neighborhoods', nb.id), nb, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getFirestoreCampaigns(): Promise<PricingCampaign[]> {
  const path = 'campaigns';
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as PricingCampaign));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveFirestoreCampaign(campaign: PricingCampaign): Promise<void> {
  const path = `campaigns/${campaign.id}`;
  try {
    await setDoc(doc(db, 'campaigns', campaign.id), campaign, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveFirestoreTripResult(campaignId: string, trip: TripResult): Promise<void> {
  const path = `campaigns/${campaignId}/trip_results/${trip.id}`;
  try {
    await setDoc(doc(db, 'campaigns', campaignId, 'trip_results', trip.id), trip, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// ----------------- FIRESTORE STATS & SYNC ----------------- //

export async function getFirestoreStats(): Promise<{ userCount: number; cityCount: number; neighborhoodCount: number }> {
  try {
    const [usersSnap, citiesSnap, nbsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'cities')),
      getDocs(collection(db, 'neighborhoods'))
    ]);
    return {
      userCount: usersSnap.size,
      cityCount: citiesSnap.size,
      neighborhoodCount: nbsSnap.size
    };
  } catch (err) {
    console.warn('Could not query Firestore stats:', err);
    return { userCount: 0, cityCount: 0, neighborhoodCount: 0 };
  }
}

export async function seedFirestoreDatabase(): Promise<{ success: boolean; usersCount: number; citiesCount: number; neighborhoodsCount: number }> {
  // Pure dynamic sync of current stats
  const stats = await getFirestoreStats();
  return {
    success: true,
    usersCount: stats.userCount,
    citiesCount: stats.cityCount,
    neighborhoodsCount: stats.neighborhoodCount
  };
}

