import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, collection, getDocs } from 'firebase/firestore';
import cfg from '../firebase-applet-config.json';
import { INITIAL_CITIES, INITIAL_NEIGHBORHOODS } from '../src/data/seedData';
import { User } from '../src/types';

const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId);

const SEED_USERS: User[] = [
  {
    id: 'usr_admin_01',
    email: 'admin@citrine-pricing.cm',
    name: 'Admin Plateforme',
    role: 'admin',
    active: true,
    createdAt: '2026-01-10T08:00:00.000Z',
    lastLoginAt: '2026-09-25T10:00:00.000Z'
  },
  {
    id: 'usr_citrine_admin',
    email: 'citrinemobilite@gmail.com',
    name: 'Citrine Mobilité (Super Admin)',
    role: 'admin',
    active: true,
    createdAt: '2026-01-10T08:00:00.000Z',
    lastLoginAt: '2026-09-25T10:00:00.000Z'
  },
  {
    id: 'usr_resp_01',
    email: 'responsable@citrine-pricing.cm',
    name: 'Sophie (Responsable Pricing)',
    role: 'responsable',
    active: true,
    createdAt: '2026-02-01T08:00:00.000Z',
    lastLoginAt: '2026-09-25T09:15:00.000Z'
  },
  {
    id: 'usr_emp_01',
    email: 'employe@citrine-pricing.cm',
    name: 'Marc (Opérations)',
    role: 'employe',
    active: true,
    createdAt: '2026-03-01T08:00:00.000Z',
    lastLoginAt: '2026-09-24T17:00:00.000Z'
  }
];

function cleanFirestoreData<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? null : v)));
}

async function seed() {
  console.log(`🚀 Connexion à Firestore : ${cfg.firestoreDatabaseId} (Projet: ${cfg.projectId})...`);

  // 1. Write Users
  console.log(`📝 Écriture de ${SEED_USERS.length} utilisateurs...`);
  const userBatch = writeBatch(db);
  for (const u of SEED_USERS) {
    userBatch.set(doc(db, 'users', u.id), cleanFirestoreData(u), { merge: true });
  }
  await userBatch.commit();
  console.log('✅ Utilisateurs enregistrés dans Firestore.');

  // 2. Write Cities
  console.log(`📝 Écriture de ${INITIAL_CITIES.length} villes (Douala, Yaoundé)...`);
  const cityBatch = writeBatch(db);
  for (const c of INITIAL_CITIES) {
    cityBatch.set(doc(db, 'cities', c.id), cleanFirestoreData(c), { merge: true });
  }
  await cityBatch.commit();
  console.log('✅ Villes enregistrées dans Firestore.');

  // 3. Write Neighborhoods in subcollection & top-level collections
  console.log(`📝 Écriture de ${INITIAL_NEIGHBORHOODS.length} quartiers urbains dans :`);
  console.log(`   - Sous-collections /cities/{cityId}/neighborhoods`);
  console.log(`   - Collection racine /neighborhoods`);
  console.log(`   - Collection racine /quartiers (alias)`);
  const BATCH_SIZE = 100;
  for (let i = 0; i < INITIAL_NEIGHBORHOODS.length; i += BATCH_SIZE) {
    const chunk = INITIAL_NEIGHBORHOODS.slice(i, i + BATCH_SIZE);
    const nbBatch = writeBatch(db);
    for (const nb of chunk) {
      const cityName = nb.cityId === 'city_douala' ? 'Douala' : 'Yaoundé';
      const enrichedNb = {
        ...nb,
        cityName,
        updatedAt: new Date().toISOString()
      };
      const cleaned = cleanFirestoreData(enrichedNb);
      // A. Per-city subcollection
      nbBatch.set(doc(db, 'cities', nb.cityId, 'neighborhoods', nb.id), cleaned, { merge: true });
      // B. Root collection /neighborhoods
      nbBatch.set(doc(db, 'neighborhoods', nb.id), cleaned, { merge: true });
    }
    await nbBatch.commit();
    console.log(`   > Lot de ${chunk.length} quartiers synchronisé (${Math.min(i + BATCH_SIZE, INITIAL_NEIGHBORHOODS.length)}/${INITIAL_NEIGHBORHOODS.length})`);
  }
  console.log('✅ Tous les quartiers ont été enregistrés dans Firestore (racine /neighborhoods et sous-collections).');

  // 4. Verification Check
  const usersSnap = await getDocs(collection(db, 'users'));
  const citiesSnap = await getDocs(collection(db, 'cities'));
  const rootNbsSnap = await getDocs(collection(db, 'neighborhoods'));
  let totalSubNbs = 0;
  for (const cityDoc of citiesSnap.docs) {
    const nbsSnap = await getDocs(collection(db, 'cities', cityDoc.id, 'neighborhoods'));
    totalSubNbs += nbsSnap.size;
    console.log(`   • Ville ${cityDoc.data().name} : ${nbsSnap.size} quartiers en sous-collection.`);
  }

  console.log('\n🎉 RÉSUMÉ FINAL DE LA BASE DE DONNÉES FIRESTORE :');
  console.log(` - Utilisateurs (/users) : ${usersSnap.size}`);
  console.log(` - Villes (/cities) : ${citiesSnap.size}`);
  console.log(` - Quartiers racine (/neighborhoods) : ${rootNbsSnap.size}`);
  console.log(` - Quartiers en sous-collections (/cities/.../neighborhoods) : ${totalSubNbs}`);
  console.log('Base de données initialisée avec succès !');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Erreur lors du peuplement Firestore :', err);
  process.exit(1);
});
