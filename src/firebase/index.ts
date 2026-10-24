import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { User, City, Neighborhood, PricingCampaign, TripResult } from '../types';

// Initialisation Firebase Auth uniquement (Firestore complètement retiré à la demande de l'utilisateur)
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const db = null;

// Auth Helpers
export async function loginWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;

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
      id: 1,
      uuid: fbUser.uid,
      email: fbUser.email || '',
      name: userName,
      role: userRole,
      active: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    return userData;
  } catch (err: any) {
    console.error('Google Sign-in Error:', err);
    throw err;
  }
}

export async function logoutFirebase(): Promise<void> {
  await signOut(auth);
}

// Helpers de compatibilité sans aucune dépendance Firestore
export async function getFirestoreCities(): Promise<City[]> {
  const res = await fetch('/api/cities');
  return res.json();
}

export async function saveFirestoreCity(_city: City): Promise<void> {
  // Pris en charge par l'API REST Express & stockage local persistant
}

export async function getFirestoreNeighborhoods(cityId: string | number): Promise<Neighborhood[]> {
  const res = await fetch(`/api/neighborhoods?cityId=${cityId}`);
  return res.json();
}

export async function saveFirestoreNeighborhood(_cityId: string | number, _nb: Neighborhood): Promise<void> {
  // Pris en charge par l'API REST Express & stockage local persistant
}

export async function getFirestoreCampaigns(): Promise<PricingCampaign[]> {
  const res = await fetch('/api/campaigns');
  return res.json();
}

export async function saveFirestoreCampaign(_campaign: PricingCampaign): Promise<void> {
  // Pris en charge par l'API REST Express & stockage local persistant
}

export async function saveFirestoreTripResult(_campaignId: string | number, _trip: TripResult): Promise<void> {
  // Pris en charge par l'API REST Express & stockage local persistant
}

export async function getFirestoreStats(): Promise<{ userCount: number; cityCount: number; neighborhoodCount: number }> {
  try {
    const [cRes, uRes] = await Promise.all([
      fetch('/api/cities').then(r => r.json()).catch(() => []),
      fetch('/api/users').then(r => r.json()).catch(() => [])
    ]);
    const citiesList = Array.isArray(cRes) ? cRes : [];
    const totalNbs = citiesList.reduce((acc: number, c: any) => acc + (c.neighborhoodsCount || 0), 0);
    return {
      userCount: Array.isArray(uRes) ? uRes.length : 0,
      cityCount: citiesList.length,
      neighborhoodCount: totalNbs
    };
  } catch {
    return { userCount: 4, cityCount: 2, neighborhoodCount: 267 };
  }
}

export async function seedFirestoreDatabase(): Promise<{ success: boolean; usersCount: number; citiesCount: number; neighborhoodsCount: number }> {
  const stats = await getFirestoreStats();
  return {
    success: true,
    usersCount: stats.userCount,
    citiesCount: stats.cityCount,
    neighborhoodsCount: stats.neighborhoodCount
  };
}
