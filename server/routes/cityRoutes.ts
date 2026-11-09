import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  fetchCitiesFromMySQL,
  upsertCityInMySQL,
  deleteCityFromMySQL,
  fetchNeighborhoodsFromMySQL,
  upsertNeighborhoodsInMySQL,
  deleteNeighborhoodFromMySQL,
  deleteNeighborhoodsByCityFromMySQL
} from '../db/mysql.js';
import {
  cities,
  neighborhoods,
  setCities,
  setNeighborhoods,
  recordHistory,
  ensureSynced,
  saveNeighborhoodsDiskBackup,
  saveCitiesDiskBackup
} from '../db/memoryStore.js';
import { getNextSequence } from '../db/counters.js';
import { City, Neighborhood } from '../types.js';

const router = Router();

function normalizeNeighborhoodUuid(value?: string): string {
  const raw = (value || randomUUID()).trim();
  if (!raw) return randomUUID();
  return raw.replace(/^nb_(?:[a-z0-9]+_)?/i, '');
}

function buildNeighborhoodRecord(item: any, cityId: string, cityName: string): Neighborhood {
  const uuid = normalizeNeighborhoodUuid(item?.uuid || item?.id);
  return {
    id: uuid,
    uuid,
    cityId: String(cityId),
    name: String(item.name || '').trim(),
    ville: item.ville ? String(item.ville).trim() : cityName,
    departement: item.departement ? String(item.departement).trim() : 'Wouri',
    arrondissement: item.arrondissement ? String(item.arrondissement).trim() : undefined,
    fullAddress: item.fullAddress ? String(item.fullAddress).trim() : `${String(item.name || '').trim()}, ${item.arrondissement || cityName}`,
    lat: Number(item.lat),
    lng: Number(item.lng),
    active: item.active !== undefined ? Boolean(item.active) : true,
    status: item.status ? String(item.status).trim() : (item.active === false ? 'inactif' : 'actif'),
    zone: item.zone ? String(item.zone).trim() : (item.zoneType || 'commercial'),
    zoneType: item.zoneType || item.zone || 'commercial',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// 1. Villes : Servies directement depuis MySQL (0 cache)
router.get('/api/cities', async (_req: Request, res: Response) => {
  try {
    const dbCities = await fetchCitiesFromMySQL();
    if (dbCities && dbCities.length > 0) {
      setCities(dbCities);
    }
  } catch (e: any) {
    console.warn('[MySQL] Erreur lecture villes:', e.message);
  }

  // Injecter le nombre de quartiers
  const enriched = cities.map(c => ({
    ...c,
    neighborhoodsCount: neighborhoods.filter(n => n.cityId === c.id || String(n.cityId) === String(c.id) || n.cityId === c.uuid).length,
    activeNeighborhoodsCount: c.active ? neighborhoods.filter(n => (n.cityId === c.id || String(n.cityId) === String(c.id) || n.cityId === c.uuid) && n.active).length : 0
  }));

  return res.json(enriched);
});

router.post('/api/cities', async (req: Request, res: Response) => {
  const { name, country, currency, currencySymbol, center, autoSchedule, airport } = req.body;
  if (!name || !country || !currency) {
    return res.status(400).json({ error: 'Nom, pays et devise sont obligatoires.' });
  }

  const citySeqId = getNextSequence('cities');
  const cityUuid = randomUUID();

  let cityAirport = undefined;
  if (airport && airport.lat && airport.lng) {
    cityAirport = {
      name: airport.name ? String(airport.name).trim() : `Aéroport de ${name}`,
      lat: parseFloat(airport.lat),
      lng: parseFloat(airport.lng),
      code: airport.code ? String(airport.code).trim().toUpperCase() : undefined,
      active: airport.active ?? true
    };
  } else if (name.toLowerCase().includes('douala')) {
    cityAirport = { name: 'Aéroport International de Douala', lat: 4.0061, lng: 9.7195, code: 'DLA', active: true };
  } else if (name.toLowerCase().includes('yaound')) {
    cityAirport = { name: 'Aéroport International de Yaoundé-Nsimalen', lat: 3.7226, lng: 11.5532, code: 'NSI', active: true };
  }

  const newCity: City = {
    id: citySeqId,
    uuid: cityUuid,
    name: name.trim(),
    country: country.trim(),
    currency: currency.trim().toUpperCase(),
    currencySymbol: currencySymbol || currency,
    center: center || { lat: 4.0511, lng: 9.7679 },
    airport: cityAirport,
    active: true,
    autoSchedule: autoSchedule || { enabled: false, slots: ['08:00', '18:00'] }
  };

  cities.push(newCity);
  saveCitiesDiskBackup();
  await upsertCityInMySQL(newCity).catch((e: any) => console.warn('[MySQL] Error creating city:', e.message));

  await recordHistory({
    action: 'create_city',
    eventType: 'cities',
    title: `Nouvelle ville ajoutée: ${newCity.name}`,
    description: `${newCity.country} - Devise: ${newCity.currency}${newCity.airport ? ` - Aéroport: ${newCity.airport.name}` : ''}`
  });

  return res.status(201).json(newCity);
});

router.put('/api/cities/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const city = cities.find(c => String(c.id) === id || c.uuid === id || c.id == id);
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  const { name, country, currency, currencySymbol, center, active, autoSchedule, airport } = req.body;
  if (name !== undefined) city.name = name.trim();
  if (country !== undefined) city.country = country.trim();
  if (currency !== undefined) city.currency = currency.trim().toUpperCase();
  if (currencySymbol !== undefined) city.currencySymbol = currencySymbol;
  if (center !== undefined) city.center = center;
  if (airport !== undefined) {
    if (airport && airport.lat && airport.lng) {
      city.airport = {
        name: airport.name ? String(airport.name).trim() : `Aéroport de ${city.name}`,
        lat: parseFloat(airport.lat),
        lng: parseFloat(airport.lng),
        code: airport.code ? String(airport.code).trim().toUpperCase() : undefined,
        active: airport.active ?? true
      };
    } else {
      city.airport = undefined;
    }
  }
  if (active !== undefined) {
    const isNewActive = Boolean(active);
    city.active = isNewActive;
    if (!isNewActive) {
      neighborhoods.forEach(n => {
        if (String(n.cityId ?? '') === String(id) || String(n.cityId ?? '') === String(city.uuid ?? '') || String(n.cityId ?? '') === String(city.id ?? '')) {
          n.active = false;
        }
      });
      const affectedNbs = neighborhoods.filter(n => String(n.cityId ?? '') === String(id) || String(n.cityId ?? '') === String(city.uuid ?? '') || String(n.cityId ?? '') === String(city.id ?? ''));
      if (affectedNbs.length > 0) {
        upsertNeighborhoodsInMySQL(affectedNbs).catch(() => {});
      }
    }
  }
  if (autoSchedule !== undefined) city.autoSchedule = autoSchedule;

  saveCitiesDiskBackup();
  await upsertCityInMySQL(city).catch((e: any) => console.warn('[MySQL] Error updating city:', e.message));
  return res.json(city);
});

router.delete('/api/cities/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = cities.findIndex(c => String(c.id) === id || c.uuid === id || c.id == id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  const deleted = cities.splice(idx, 1)[0];
  const remainingNbs = neighborhoods.filter(n => n.cityId !== id && n.cityId !== deleted.uuid && String(n.cityId) !== String(deleted.id));
  setNeighborhoods(remainingNbs);
  saveNeighborhoodsDiskBackup();
  saveCitiesDiskBackup();

  await deleteCityFromMySQL(deleted.uuid || deleted.id);

  await recordHistory({
    action: 'delete_city',
    eventType: 'cities',
    title: `Ville supprimée: ${deleted.name}`,
    description: `Suppression de ${deleted.name} et de tous ses quartiers associés.`
  });

  return res.json({ success: true, message: 'Ville et quartiers associés supprimés.' });
});

// 2. Quartiers : Servis directement depuis MySQL (0 cache)
router.get('/api/neighborhoods', async (req: Request, res: Response) => {
  const { cityId } = req.query;

  try {
    const dbNbs = await fetchNeighborhoodsFromMySQL(cityId ? String(cityId) : undefined);
    if (dbNbs && dbNbs.length > 0) {
      if (cityId) {
        const others = neighborhoods.filter(n => String(n.cityId) !== String(cityId));
        setNeighborhoods([...others, ...dbNbs]);
      } else {
        setNeighborhoods(dbNbs);
      }
    }
  } catch (e: any) {
    console.warn('[MySQL] Erreur lecture quartiers:', e.message);
  }

  let list = neighborhoods;
  if (cityId) {
    list = list.filter(n => String(n.cityId ?? '') === String(cityId) || String(n.cityId ?? '') === String(cities.find(c => String(c.id) === String(cityId) || c.uuid === cityId)?.id ?? '') || String(n.cityId ?? '') === String(cities.find(c => String(c.id) === String(cityId) || c.uuid === cityId)?.uuid ?? ''));
  }

  const enriched = list.map(n => {
    const c = cities.find(city => city.id === n.cityId || city.uuid === n.cityId);
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

  const city = cities.find(c => String(c.id) === String(cityId) || c.uuid === cityId || c.id == cityId);
  if (!city) {
    return res.status(404).json({ error: 'Ville parente introuvable.' });
  }

  const isActive = active !== undefined ? Boolean(active) : (status ? status.toLowerCase() !== 'inactif' : true);
  const nbUuid = normalizeNeighborhoodUuid(randomUUID());

  const newNb: Neighborhood = {
    id: nbUuid,
    uuid: nbUuid,
    cityId: String(city.uuid || city.id),
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
  saveNeighborhoodsDiskBackup(String(city.id));
  await upsertNeighborhoodsInMySQL([newNb]);

  return res.status(201).json({ ...newNb, cityName: city.name });
});

router.put('/api/neighborhoods/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const nb = neighborhoods.find(n => String(n.id) === id || n.uuid === id || n.id == id);
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

  saveNeighborhoodsDiskBackup(String(nb.cityId));
  await upsertNeighborhoodsInMySQL([nb]);
  return res.json(nb);
});

router.delete('/api/neighborhoods/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = neighborhoods.findIndex(n => String(n.id) === id || n.uuid === id || n.id == id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Quartier introuvable.' });
  }

  const deleted = neighborhoods.splice(idx, 1)[0];
  saveNeighborhoodsDiskBackup(String(deleted.cityId));
  await deleteNeighborhoodFromMySQL(deleted.uuid || deleted.id);
  return res.json({ success: true, message: 'Quartier supprimé avec succès.' });
});

router.delete('/api/neighborhoods/city/:cityId', async (req: Request, res: Response) => {
  const { cityId } = req.params;
  const countBefore = neighborhoods.length;
  const filtered = neighborhoods.filter(n => String(n.cityId ?? '') !== String(cityId));
  setNeighborhoods(filtered);
  saveNeighborhoodsDiskBackup(String(cityId));
  const deletedCount = countBefore - filtered.length;

  await deleteNeighborhoodsByCityFromMySQL(cityId);

  return res.json({ success: true, deletedCount, message: `${deletedCount} quartier(s) supprimé(s).` });
});

router.post('/api/neighborhoods/batch-toggle', async (req: Request, res: Response) => {
  const { cityId, active } = req.body;
  if (cityId === undefined || active === undefined) {
    return res.status(400).json({ error: 'cityId et active sont obligatoires.' });
  }

  const boolActive = Boolean(active);
  let updatedCount = 0;
  const toUpdate: Neighborhood[] = [];

  neighborhoods.forEach(n => {
    if (String(n.cityId ?? '') === String(cityId)) {
      n.active = boolActive;
      n.status = boolActive ? 'actif' : 'inactif';
      toUpdate.push(n);
      updatedCount++;
    }
  });

  saveNeighborhoodsDiskBackup(String(cityId));
  if (toUpdate.length > 0) {
    await upsertNeighborhoodsInMySQL(toUpdate);
  }

  return res.json({ success: true, updatedCount, active: boolActive });
});

router.post('/api/neighborhoods/import-batch', async (req: Request, res: Response) => {
  const { cityId, neighborhoods: importedList } = req.body;
  if (!cityId || !Array.isArray(importedList) || importedList.length === 0) {
    return res.status(400).json({ error: 'cityId et liste de quartiers valides sont requis.' });
  }

  const city = cities.find(c => String(c.id) === String(cityId) || c.uuid === cityId);
  const cityName = city?.name || 'Inconnue';

  const newRecords: Neighborhood[] = importedList.map(item => buildNeighborhoodRecord(item, String(cityId), cityName));

  neighborhoods.push(...newRecords);
  saveNeighborhoodsDiskBackup(String(cityId));
  await upsertNeighborhoodsInMySQL(newRecords);

  return res.json({ success: true, count: newRecords.length, neighborhoods: newRecords });
});

router.post('/api/neighborhoods/reconcile-batch', async (req: Request, res: Response) => {
  const { cityId, items } = req.body;
  if (!cityId || !Array.isArray(items)) {
    return res.status(400).json({ error: 'cityId et items sont requis.' });
  }

  const city = cities.find(c => String(c.id) === String(cityId) || c.uuid === cityId);
  const cityName = city?.name || 'Inconnue';

  let updatedCount = 0;
  let createdCount = 0;
  const toUpsert: Neighborhood[] = [];

  for (const item of items) {
    const existing = neighborhoods.find(n =>
      String(n.cityId) === String(cityId) &&
      n.name.toLowerCase().trim() === String(item.name || '').toLowerCase().trim()
    );

    if (existing) {
      if (item.lat) existing.lat = Number(item.lat);
      if (item.lng) existing.lng = Number(item.lng);
      if (item.arrondissement) existing.arrondissement = item.arrondissement;
      if (item.active !== undefined) existing.active = Boolean(item.active);
      existing.updatedAt = new Date().toISOString();
      toUpsert.push(existing);
      updatedCount++;
    } else {
      const newRec = buildNeighborhoodRecord(item, String(cityId), cityName);
      neighborhoods.push(newRec);
      toUpsert.push(newRec);
      createdCount++;
    }
  }

  saveNeighborhoodsDiskBackup(String(cityId));
  if (toUpsert.length > 0) {
    await upsertNeighborhoodsInMySQL(toUpsert);
  }

  return res.json({
    success: true,
    updatedCount,
    createdCount,
    ignoredCount: 0,
    message: `${updatedCount} mis à jour, ${createdCount} créés.`
  });
});

export default router;
