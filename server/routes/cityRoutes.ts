import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, cleanFirestoreDoc, safeFirestoreWrite, isFirestoreQuotaExceeded, isQuotaExceededError, flagFirestoreQuotaExceeded } from '../db/firestore.js';
import { cities, neighborhoods, setCities, setNeighborhoods, recordHistory, ensureSynced, saveNeighborhoodsDiskBackup } from '../db/memoryStore.js';
import { City, Neighborhood } from '../types.js';

const router = Router();

// Cities (Servies depuis la RAM en priorité - 0 lecture Firestore inutile)
router.get('/api/cities', async (req: Request, res: Response) => {
  await ensureSynced().catch(() => {});

  const forceRefresh = req.query.forceRefresh === 'true';

  // Ne requêter Firestore QUE si la RAM est vide ou en cas de rafraîchissement forcé explicite
  if (db && !isFirestoreQuotaExceeded() && (cities.length === 0 || forceRefresh)) {
    try {
      const snap = await getDocs(collection(db, 'cities'));
      if (!snap.empty) {
        const dbCities = snap.docs.map(d => ({ id: d.id, ...d.data() } as City));
        setCities(dbCities);
      }
    } catch (e: any) {
      if (isQuotaExceededError(e)) {
        flagFirestoreQuotaExceeded(e);
      } else {
        console.warn('[Firestore] get cities notice:', e.message);
      }
    }
  }

  // Injecter le nombre de quartiers
  const enriched = cities.map(c => ({
    ...c,
    neighborhoodsCount: neighborhoods.filter(n => n.cityId === c.id).length,
    activeNeighborhoodsCount: c.active ? neighborhoods.filter(n => n.cityId === c.id && n.active).length : 0
  }));

  return res.json(enriched);
});

router.post('/api/cities', async (req: Request, res: Response) => {
  const { name, country, currency, currencySymbol, center, autoSchedule } = req.body;
  if (!name || !country || !currency) {
    return res.status(400).json({ error: 'Nom, pays et devise sont obligatoires.' });
  }

  const newCity: City = {
    id: `city_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
    name: name.trim(),
    country: country.trim(),
    currency: currency.trim().toUpperCase(),
    currencySymbol: currencySymbol || currency,
    center: center || { lat: 4.0511, lng: 9.7679 },
    active: true,
    autoSchedule: autoSchedule || { enabled: false, slots: ['08:00', '18:00'] }
  };

  cities.push(newCity);
  await safeFirestoreWrite('createCity', () => setDoc(doc(db!, 'cities', newCity.id), cleanFirestoreDoc(newCity)));

  await recordHistory({
    action: 'create_city',
    eventType: 'cities',
    title: `Nouvelle ville ajoutée: ${newCity.name}`,
    description: `${newCity.country} - Devise: ${newCity.currency}`
  });

  return res.status(201).json(newCity);
});

router.put('/api/cities/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const city = cities.find(c => c.id === id);
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  const { name, country, currency, currencySymbol, center, active, autoSchedule } = req.body;
  if (name !== undefined) city.name = name.trim();
  if (country !== undefined) city.country = country.trim();
  if (currency !== undefined) city.currency = currency.trim().toUpperCase();
  if (currencySymbol !== undefined) city.currencySymbol = currencySymbol;
  if (center !== undefined) city.center = center;
  if (active !== undefined) {
    const isNewActive = Boolean(active);
    city.active = isNewActive;
    if (!isNewActive) {
      // Lorsqu'une ville est désactivée, ses quartiers ne sont plus monitorés
      neighborhoods.forEach(n => {
        if (n.cityId === id) {
          n.active = false;
          if (db) {
            safeFirestoreWrite('deactivateNbOnCityDisable', () =>
              setDoc(doc(db!, 'neighborhoods', n.id), { active: false }, { merge: true })
            );
          }
        }
      });
    }
  }
  if (autoSchedule !== undefined) city.autoSchedule = autoSchedule;

  await safeFirestoreWrite('updateCity', () => setDoc(doc(db!, 'cities', id), cleanFirestoreDoc(city), { merge: true }));
  return res.json(city);
});

router.delete('/api/cities/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = cities.findIndex(c => c.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  const deleted = cities.splice(idx, 1)[0];
  const remainingNbs = neighborhoods.filter(n => n.cityId !== id);
  setNeighborhoods(remainingNbs);
  saveNeighborhoodsDiskBackup();

  await safeFirestoreWrite('deleteCity', () => deleteDoc(doc(db!, 'cities', id)));

  await recordHistory({
    action: 'delete_city',
    eventType: 'cities',
    title: `Ville supprimée: ${deleted.name}`,
    description: `Suppression de ${deleted.name} et de tous ses quartiers associés.`
  });

  return res.json({ success: true, message: 'Ville et quartiers associés supprimés.' });
});

// Neighborhoods (Servis depuis la RAM en priorité - 0 lecture Firestore)
router.get('/api/neighborhoods', async (req: Request, res: Response) => {
  const { cityId, forceRefresh } = req.query;

  await ensureSynced().catch(() => {});

  if (db && !isFirestoreQuotaExceeded() && forceRefresh === 'true') {
    try {
      const snap = await getDocs(collection(db, 'neighborhoods'));
      if (!snap.empty) {
        const dbNbs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Neighborhood));
        setNeighborhoods(dbNbs);
      }
    } catch (e: any) {
      if (isQuotaExceededError(e)) {
        flagFirestoreQuotaExceeded(e);
      } else {
        console.warn('[Firestore] get neighborhoods notice:', e.message);
      }
    }
  }

  let list = neighborhoods;
  if (cityId) {
    list = list.filter(n => n.cityId === String(cityId));
  }

  // Injecter le nom de la ville
  const enriched = list.map(n => {
    const c = cities.find(city => city.id === n.cityId);
    return {
      ...n,
      cityName: c?.name || 'Inconnue'
    };
  });

  return res.json(enriched);
});

router.post('/api/neighborhoods', async (req: Request, res: Response) => {
  const { cityId, name, lat, lng, zoneType, zone, active, status, fullAddress, arrondissement, ville, departement } = req.body;
  if (!cityId || !name || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'cityId, nom, latitude et longitude sont obligatoires.' });
  }

  const city = cities.find(c => c.id === cityId);
  if (!city) {
    return res.status(404).json({ error: 'Ville parente introuvable.' });
  }

  const isActive = active !== undefined ? Boolean(active) : (status ? status.toLowerCase() !== 'inactif' : true);

  const newNb: Neighborhood = {
    id: `nb_${randomUUID()}`,
    cityId,
    name: name.trim(),
    ville: ville ? String(ville).trim() : city.name,
    departement: departement ? String(departement).trim() : 'Wouri',
    arrondissement: arrondissement ? String(arrondissement).trim() : undefined,
    fullAddress: fullAddress ? String(fullAddress).trim() : `${name.trim()}, ${arrondissement || city.name}`,
    lat: Number(lat),
    lng: Number(lng),
    active: isActive,
    status: status ? String(status).trim() : (isActive ? 'actif' : 'inactif'),
    zone: zone ? String(zone).trim() : (zoneType || 'commercial'),
    zoneType: (zone || zoneType) || 'commercial',
    createdAt: new Date().toISOString()
  };

  neighborhoods.push(newNb);
  saveNeighborhoodsDiskBackup();
  await safeFirestoreWrite('createNb', () => setDoc(doc(db!, 'neighborhoods', newNb.id), cleanFirestoreDoc(newNb)));

  return res.status(201).json({ ...newNb, cityName: city.name });
});

router.put('/api/neighborhoods/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const nb = neighborhoods.find(n => n.id === id);
  if (!nb) {
    return res.status(404).json({ error: 'Quartier introuvable.' });
  }

  const { name, lat, lng, zoneType, zone, active, status, fullAddress, arrondissement, ville, departement, cityId } = req.body;
  if (name !== undefined) nb.name = name.trim();
  if (lat !== undefined) nb.lat = Number(lat);
  if (lng !== undefined) nb.lng = Number(lng);
  if (zone !== undefined) nb.zone = String(zone).trim();
  if (zoneType !== undefined) nb.zoneType = zoneType;
  if (active !== undefined) nb.active = Boolean(active);
  if (status !== undefined) nb.status = String(status).trim();
  if (fullAddress !== undefined) nb.fullAddress = String(fullAddress).trim();
  if (arrondissement !== undefined) nb.arrondissement = String(arrondissement).trim();
  if (ville !== undefined) nb.ville = String(ville).trim();
  if (departement !== undefined) nb.departement = String(departement).trim();
  if (cityId !== undefined) nb.cityId = String(cityId).trim();
  nb.updatedAt = new Date().toISOString();

  saveNeighborhoodsDiskBackup();
  await safeFirestoreWrite('updateNb', () => setDoc(doc(db!, 'neighborhoods', id), cleanFirestoreDoc(nb), { merge: true }));
  return res.json(nb);
});

router.delete('/api/neighborhoods/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = neighborhoods.findIndex(n => n.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Quartier introuvable.' });
  }

  neighborhoods.splice(idx, 1);
  saveNeighborhoodsDiskBackup();
  await safeFirestoreWrite('deleteNb', () => deleteDoc(doc(db!, 'neighborhoods', id)));
  return res.json({ success: true, message: 'Quartier supprimé avec succès.' });
});

router.delete('/api/neighborhoods/city/:cityId', async (req: Request, res: Response) => {
  const { cityId } = req.params;
  const countBefore = neighborhoods.length;
  const filtered = neighborhoods.filter(n => n.cityId !== cityId);
  setNeighborhoods(filtered);
  saveNeighborhoodsDiskBackup();
  const deletedCount = countBefore - filtered.length;

  if (db) {
    try {
      const snap = await getDocs(collection(db, 'neighborhoods'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        if (d.data().cityId === cityId) {
          batch.delete(d.ref);
        }
      });
      await batch.commit();
    } catch (e: any) {
      console.warn('[Firestore] Batch delete error:', e.message);
    }
  }

  return res.json({ success: true, message: `${deletedCount} quartier(s) supprimé(s).` });
});

router.post('/api/neighborhoods/batch-toggle', async (req: Request, res: Response) => {
  const { cityId, active } = req.body;
  if (!cityId || active === undefined) {
    return res.status(400).json({ error: 'cityId et statut active requis.' });
  }

  const boolActive = Boolean(active);
  neighborhoods.forEach(n => {
    if (n.cityId === cityId) {
      n.active = boolActive;
    }
  });

  return res.json({ success: true, active: boolActive });
});

router.post('/api/neighborhoods/seed-city', async (req: Request, res: Response) => {
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

router.post('/api/neighborhoods/import-batch', async (req: Request, res: Response) => {
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
        createdAt: new Date().toISOString()
      };
      createdNeighborhoods.push(nb);
    }
  });

  neighborhoods.push(...createdNeighborhoods);

  if (createdNeighborhoods.length > 0 && db) {
    await safeFirestoreWrite('importBatchNeighborhoods', async () => {
      const BATCH_SIZE = 100;
      for (let i = 0; i < createdNeighborhoods.length; i += BATCH_SIZE) {
        const chunk = createdNeighborhoods.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db!);
        for (const nb of chunk) {
          const cleaned = cleanFirestoreDoc({ ...nb, cityName: city.name });
          batch.set(doc(db!, 'neighborhoods', nb.id), cleaned, { merge: true });
        }
        await batch.commit();
      }
    });
  }

  return res.status(201).json({
    success: true,
    count: createdNeighborhoods.length,
    message: `${createdNeighborhoods.length} quartiers importés avec succès.`
  });
});

router.post('/api/neighborhoods/reconcile-batch', async (req: Request, res: Response) => {
  const { cityId, items } = req.body;
  if (!cityId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'cityId et une liste non-vide de rectifications sont requis.' });
  }

  const city = cities.find(c => c.id === cityId);
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  let updatedCount = 0;
  let createdCount = 0;
  let ignoredCount = 0;
  const modifiedDocs: Neighborhood[] = [];

  for (const item of items) {
    // 1. Protection stricte contre Douala 6ème (exclu à la demande de l'utilisateur)
    const isDla6 = item.status === 'ignored_douala_6' ||
      /\b(douala\s*6|douala\s*6e|douala\s*6eme|douala\s*6ieme|douala\s*vi|manoka)\b/i.test(item.arrondissement || '') ||
      /\b(douala\s*6|douala\s*6e|douala\s*6eme|douala\s*6ieme|douala\s*vi|manoka)\b/i.test(item.fullAddress || '') ||
      /\b(douala\s*6|douala\s*6e|douala\s*6eme|douala\s*6ieme|douala\s*vi|manoka)\b/i.test(item.name || '');

    if (isDla6) {
      ignoredCount++;
      continue;
    }

    if (item.status === 'update' && item.targetId) {
      const existing = neighborhoods.find(n => n.id === item.targetId);
      if (existing) {
        existing.name = String(item.name).trim();
        existing.fullAddress = String(item.fullAddress || '').trim();
        if (item.ville) existing.ville = String(item.ville).trim();
        if (item.departement) existing.departement = String(item.departement).trim();
        if (item.arrondissement) existing.arrondissement = String(item.arrondissement).trim();
        if (item.zone) existing.zone = String(item.zone).trim();
        if (item.zoneType) existing.zoneType = item.zoneType;
        if (item.itemStatus) existing.status = String(item.itemStatus).trim();
        if (item.active !== undefined) existing.active = Boolean(item.active);
        existing.lat = Number(item.lat);
        existing.lng = Number(item.lng);
        existing.updatedAt = new Date().toISOString();
        updatedCount++;
        modifiedDocs.push(existing);
      }
    } else if (item.status === 'create') {
      const newNb: Neighborhood = {
        id: `nb_dla_${randomUUID()}`,
        cityId,
        name: String(item.name).trim(),
        ville: item.ville ? String(item.ville).trim() : city.name,
        departement: item.departement ? String(item.departement).trim() : 'Wouri',
        arrondissement: item.arrondissement ? String(item.arrondissement).trim() : undefined,
        fullAddress: String(item.fullAddress || '').trim(),
        lat: Number(item.lat),
        lng: Number(item.lng),
        active: item.active !== undefined ? Boolean(item.active) : true,
        status: item.itemStatus ? String(item.itemStatus).trim() : (item.active === false ? 'inactif' : 'actif'),
        zone: item.zone ? String(item.zone).trim() : 'commercial',
        zoneType: item.zoneType || 'commercial',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      neighborhoods.push(newNb);
      createdCount++;
      modifiedDocs.push(newNb);
    }
  }

  // Persistance immédiate sur le disque dans defaultNeighborhoods.json
  saveNeighborhoodsDiskBackup();

  // Persistance dans Firestore en arrière-plan sans bloquer
  if (modifiedDocs.length > 0 && db && !isFirestoreQuotaExceeded()) {
    safeFirestoreWrite('reconcileBatchNeighborhoods', async () => {
      const BATCH_SIZE = 100;
      for (let i = 0; i < modifiedDocs.length; i += BATCH_SIZE) {
        const chunk = modifiedDocs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db!);
        for (const nb of chunk) {
          const cleaned = cleanFirestoreDoc({ ...nb, cityName: city.name });
          batch.set(doc(db!, 'neighborhoods', nb.id), cleaned, { merge: true });
        }
        await batch.commit();
      }
    }).catch(e => console.warn('[Firestore] Reconcile batch save notice:', e?.message));
  }

  await recordHistory({
    action: 'reconcile_neighborhoods',
    eventType: 'neighborhoods',
    title: 'Rectification des coordonnées et quartiers via Excel',
    description: `${updatedCount} quartiers rectifiés, ${createdCount} nouveaux créés, ${ignoredCount} ignorés (Douala 6ème) pour ${city.name}.`,
    status: 'success'
  });

  return res.json({
    success: true,
    updatedCount,
    createdCount,
    ignoredCount,
    totalProcessed: updatedCount + createdCount,
    message: `${updatedCount} quartier(s) rectifié(s) et ${createdCount} nouveau(x) quartier(s) créé(s) avec succès.`
  });
});

export default router;
