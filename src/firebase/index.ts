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
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { User, City, Neighborhood, PricingCampaign, TripResult } from '../types';

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
