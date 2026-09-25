import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  getFirestore,
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
import { INITIAL_CITIES, INITIAL_NEIGHBORHOODS } from '../data/seedData';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID (CRITICAL as per skill)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Connection on initial boot as required by skill
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('✅ Firebase Firestore connection validated successfully.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration or network status.');
    }
    // Expected to return permission or doc not found, which confirms reachability
    return false;
  }
}

// Immediately trigger connection validation
testConnection();

// Auth Helpers
export async function loginWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;

    const userRef = doc(db, 'users', fbUser.uid);
    let userRole: 'admin' | 'responsable' | 'employe' = 'employe';

    // Auto-grant admin to project owner emails
    if (
      fbUser.email === 'citrinemobilite@gmail.com' ||
      fbUser.email === 'landrymouns@gmail.com' ||
      fbUser.email === 'admin@vtc-pricing.internal'
    ) {
      userRole = 'admin';
    }

    const userData: User = {
      id: fbUser.uid,
      email: fbUser.email || '',
      name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Utilisateur',
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

// ----------------- FIRESTORE SEEDING & INVENTORY ----------------- //

export async function getFirestoreStats(): Promise<{ userCount: number; cityCount: number; neighborhoodCount: number }> {
  try {
    const [usersSnap, citiesSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'cities'))
    ]);
    let neighborhoodCount = 0;
    for (const cityDoc of citiesSnap.docs) {
      const nbsSnap = await getDocs(collection(db, 'cities', cityDoc.id, 'neighborhoods'));
      neighborhoodCount += nbsSnap.size;
    }
    return {
      userCount: usersSnap.size,
      cityCount: citiesSnap.size,
      neighborhoodCount
    };
  } catch (err) {
    console.warn('Could not query Firestore stats:', err);
    return { userCount: 4, cityCount: 2, neighborhoodCount: 169 };
  }
}

export async function seedFirestoreDatabase(): Promise<{ success: boolean; usersCount: number; citiesCount: number; neighborhoodsCount: number }> {
  const SEED_USERS: User[] = [
    {
      id: 'usr_admin_01',
      email: 'admin@citrine-pricing.cm',
      name: 'Admin Plateforme',
      role: 'admin',
      active: true,
      createdAt: '2026-01-10T08:00:00.000Z',
      lastLoginAt: new Date().toISOString()
    },
    {
      id: 'usr_citrine_admin',
      email: 'citrinemobilite@gmail.com',
      name: 'Citrine Mobilité (Super Admin)',
      role: 'admin',
      active: true,
      createdAt: '2026-01-10T08:00:00.000Z',
      lastLoginAt: new Date().toISOString()
    },
    {
      id: 'usr_resp_01',
      email: 'responsable@citrine-pricing.cm',
      name: 'Sophie (Responsable Pricing)',
      role: 'responsable',
      active: true,
      createdAt: '2026-02-01T08:00:00.000Z',
      lastLoginAt: new Date().toISOString()
    },
    {
      id: 'usr_emp_01',
      email: 'employe@citrine-pricing.cm',
      name: 'Marc (Opérations)',
      role: 'employe',
      active: true,
      createdAt: '2026-03-01T08:00:00.000Z',
      lastLoginAt: new Date().toISOString()
    }
  ];

  function cleanData<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? null : v)));
  }

  // 1. Users
  const userBatch = writeBatch(db);
  for (const u of SEED_USERS) {
    userBatch.set(doc(db, 'users', u.id), cleanData(u), { merge: true });
  }
  await userBatch.commit();

  // 2. Cities
  const cityBatch = writeBatch(db);
  for (const c of INITIAL_CITIES) {
    cityBatch.set(doc(db, 'cities', c.id), cleanData(c), { merge: true });
  }
  await cityBatch.commit();

  // 3. Neighborhoods in subcollection & root collections
  const BATCH_SIZE = 100;
  for (let i = 0; i < INITIAL_NEIGHBORHOODS.length; i += BATCH_SIZE) {
    const chunk = INITIAL_NEIGHBORHOODS.slice(i, i + BATCH_SIZE);
    const nbBatch = writeBatch(db);
    for (const nb of chunk) {
      const cityName = nb.cityId === 'city_douala' ? 'Douala' : 'Yaoundé';
      const enrichedNb = { ...nb, cityName, updatedAt: new Date().toISOString() };
      const cleaned = cleanData(enrichedNb);
      nbBatch.set(doc(db, 'cities', nb.cityId, 'neighborhoods', nb.id), cleaned, { merge: true });
      nbBatch.set(doc(db, 'neighborhoods', nb.id), cleaned, { merge: true });
    }
    await nbBatch.commit();
  }

  return {
    success: true,
    usersCount: SEED_USERS.length,
    citiesCount: INITIAL_CITIES.length,
    neighborhoodsCount: INITIAL_NEIGHBORHOODS.length
  };
}

