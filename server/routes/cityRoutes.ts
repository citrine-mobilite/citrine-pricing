import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { cities, neighborhoods, setCities, setNeighborhoods, recordHistory, ensureSynced, saveNeighborhoodsDiskBackup, saveCitiesDiskBackup } from '../db/memoryStore.js';
import { City, Neighborhood } from '../types.js';
import { getNextSequence } from '../db/counters.js';
import {
  upsertCityToSupabase,
  deleteCityFromSupabase,
  upsertNeighborhoodToSupabase,
  deleteNeighborhoodFromSupabase,
  clearCityNeighborhoodsInSupabase,
  batchUpsertNeighborhoodsToSupabase
} from '../db/supabase.js';

const router = Router();

// Cities (Servies à 100% depuis la RAM et le stockage persistant)
router.get('/api/cities', async (_req: Request, res: Response) => {
  // Injecter le nombre de quartiers dynamiquement
  const enriched = cities.map(c => {
    const cId = String(c.id);
    const cUuid = c.uuid;
    const cName = c.name ? c.name.toLowerCase().trim() : '';
    const matchNb = (n: Neighborhood) => {
      if (n.cityId === cUuid || String(n.cityId) === cId) return true;
      if (cName && (n.ville || n.cityName || '').toLowerCase().trim().includes(cName)) return true;
      return false;
    };
    return {
      ...c,
      neighborhoodsCount: neighborhoods.filter(matchNb).length,
      activeNeighborhoodsCount: c.active ? neighborhoods.filter(n => matchNb(n) && n.active).length : 0
    };
  });

  res.setHeader('X-Cache', 'HIT-RAM');
  return res.json(enriched);
});

router.post('/api/cities', async (req: Request, res: Response) => {
  const { name, country, currency, currencySymbol, center, autoSchedule } = req.body;
  if (!name || !country || !currency) {
    return res.status(400).json({ error: 'Nom, pays et devise sont obligatoires.' });
  }

  const newCity: City = {
    id: String(getNextSequence('cities')),
    uuid: `city_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
    name: name.trim(),
    country: country.trim(),
    currency: currency.trim().toUpperCase(),
    currencySymbol: currencySymbol || currency,
    center: center || { lat: 4.0511, lng: 9.7679 },
    active: true,
    autoSchedule: autoSchedule || { enabled: false, slots: ['08:00', '18:00'] }
  };

  cities.push(newCity);
  saveCitiesDiskBackup();
  upsertCityToSupabase(newCity).catch(() => {});

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
  const city = cities.find(c => String(c.id) === String(id) || c.uuid === id);
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
    city.active = Boolean(active);
  }
  if (autoSchedule !== undefined) city.autoSchedule = autoSchedule;

  saveCitiesDiskBackup();
  upsertCityToSupabase(city).catch(() => {});
  return res.json(city);
});

router.delete('/api/cities/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = cities.findIndex(c => String(c.id) === String(id) || c.uuid === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  const deleted = cities.splice(idx, 1)[0];
  saveCitiesDiskBackup();
  const remainingNbs = neighborhoods.filter(n => n.cityId !== String(deleted.id) && n.cityId !== deleted.uuid);
  setNeighborhoods(remainingNbs);
  saveNeighborhoodsDiskBackup();
  deleteCityFromSupabase(String(deleted.id)).catch(() => {});

  await recordHistory({
    action: 'delete_city',
    eventType: 'cities',
    title: `Ville supprimée: ${deleted.name}`,
    description: `Suppression de ${deleted.name} et de tous ses quartiers associés.`
  });

  return res.json({ success: true, message: 'Ville et quartiers associés supprimés.' });
});

// Neighborhoods (Servis à 100% depuis la RAM et defaultNeighborhoods.json)
router.get('/api/neighborhoods', async (req: Request, res: Response) => {
  const { cityId } = req.query;

  let list = neighborhoods;
  if (cityId) {
    const targetCity = cities.find(c => String(c.id) === String(cityId) || c.uuid === cityId);
    const cUuid = targetCity?.uuid || String(cityId);
    const cId = targetCity ? String(targetCity.id) : null;
    const cName = targetCity?.name ? targetCity.name.toLowerCase().trim() : '';
    list = list.filter(n => 
      n.cityId === cUuid || 
      (cId && String(n.cityId) === cId) ||
      (cName && (n.ville || n.cityName || '').toLowerCase().trim().includes(cName))
    );
  }

  // Injecter le nom de la ville
  const enriched = list.map(n => {
    const c = cities.find(city => city.uuid === n.cityId || String(city.id) === n.cityId);
    return {
      ...n,
      cityName: c?.name || 'Inconnue'
    };
  });

  res.setHeader('X-Cache', 'HIT-RAM');
  return res.json(enriched);
});

router.post('/api/neighborhoods', async (req: Request, res: Response) => {
  const { cityId, name, lat, lng, zoneType, zone, active, status, fullAddress, arrondissement, ville, departement } = req.body;
  if (!cityId || !name || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'cityId, nom, latitude et longitude sont obligatoires.' });
  }

  const city = cities.find(c => String(c.id) === String(cityId) || c.uuid === cityId);
  if (!city) {
    return res.status(404).json({ error: 'Ville parente introuvable.' });
  }

  const isActive = active !== undefined ? Boolean(active) : (status ? status.toLowerCase() !== 'inactif' : true);

  const newNb: Neighborhood = {
    id: String(getNextSequence('neighborhoods')),
    uuid: `nb_${randomUUID()}`,
    cityId: city.uuid || String(city.id),
    name: name.trim(),
    lat: Number(lat),
    lng: Number(lng),
    zone: zone || 'commercial',
    zoneType: zoneType || 'commercial',
    status: isActive ? 'actif' : 'inactif',
    active: isActive,
    fullAddress: fullAddress || `${name.trim()}, ${city.name}, Cameroun`,
    arrondissement: arrondissement || undefined,
    ville: ville || city.name,
    departement: departement || undefined,
    createdAt: new Date().toISOString()
  };

  neighborhoods.push(newNb);
  saveNeighborhoodsDiskBackup();
  upsertNeighborhoodToSupabase(newNb).catch(() => {});

  return res.status(201).json({ ...newNb, cityName: city.name });
});

router.put('/api/neighborhoods/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const nb = neighborhoods.find(n => String(n.id) === String(id) || n.uuid === id);
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
  upsertNeighborhoodToSupabase(nb).catch(() => {});
  return res.json(nb);
});

router.delete('/api/neighborhoods/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = neighborhoods.findIndex(n => String(n.id) === String(id) || n.uuid === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Quartier introuvable.' });
  }

  const deleted = neighborhoods.splice(idx, 1)[0];
  saveNeighborhoodsDiskBackup();
  deleteNeighborhoodFromSupabase(String(deleted.id)).catch(() => {});
  return res.json({ success: true, message: 'Quartier supprimé avec succès.' });
});

router.delete('/api/neighborhoods/city/:cityId', async (req: Request, res: Response) => {
  const { cityId } = req.params;
  const targetCity = cities.find(c => String(c.id) === String(cityId) || c.uuid === cityId);
  const cUuid = targetCity?.uuid || String(cityId);
  const cId = targetCity ? String(targetCity.id) : null;

  const countBefore = neighborhoods.length;
  const filtered = neighborhoods.filter(n => n.cityId !== cUuid && (!cId || String(n.cityId) !== cId));
  setNeighborhoods(filtered);
  saveNeighborhoodsDiskBackup();
  clearCityNeighborhoodsInSupabase(cUuid).catch(() => {});
  const deletedCount = countBefore - filtered.length;

  return res.json({
    success: true,
    deletedCount,
    message: `${deletedCount} quartiers supprimés pour la ville.`
  });
});

router.post('/api/neighborhoods/bulk-toggle', async (req: Request, res: Response) => {
  const { active, cityId } = req.body;
  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'Le champ active (booléen) est requis.' });
  }

  const targetCity = cityId ? cities.find(c => String(c.id) === String(cityId) || c.uuid === cityId) : null;
  const cUuid = targetCity?.uuid || String(cityId);
  const cId = targetCity ? String(targetCity.id) : null;

  let count = 0;
  for (const nb of neighborhoods) {
    const matchesCity = !cityId || nb.cityId === cUuid || (cId && String(nb.cityId) === cId);
    if (matchesCity) {
      nb.active = active;
      nb.status = active ? 'actif' : 'inactif';
      count++;
    }
  }

  saveNeighborhoodsDiskBackup();
  return res.json({ success: true, count, active });
});

router.post('/api/neighborhoods/import-batch', async (req: Request, res: Response) => {
  const { cityId, neighborhoods: importedList } = req.body;
  if (!cityId || !Array.isArray(importedList) || importedList.length === 0) {
    return res.status(400).json({ error: 'cityId et une liste non-vide de quartiers sont requis.' });
  }

  const city = cities.find(c => String(c.id) === String(cityId) || c.uuid === cityId);
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  const createdNeighborhoods: Neighborhood[] = [];
  for (const item of importedList) {
    if (!item.name || item.lat === undefined || item.lng === undefined) continue;

    // Protection Douala 6ème (Manoka)
    const isDla6 = /\b(douala\s*6|douala\s*6e|douala\s*6eme|douala\s*6ieme|douala\s*vi|manoka)\b/i.test(item.arrondissement || '') ||
      /\b(douala\s*6|douala\s*6e|douala\s*6eme|douala\s*6ieme|douala\s*vi|manoka)\b/i.test(item.fullAddress || '') ||
      /\b(douala\s*6|douala\s*6e|douala\s*6eme|douala\s*6ieme|douala\s*vi|manoka)\b/i.test(item.name || '');

    if (isDla6) continue;

    const newNb: Neighborhood = {
      id: String(getNextSequence('neighborhoods')),
      uuid: `nb_${randomUUID()}`,
      cityId: city.uuid || String(city.id),
      name: String(item.name).trim(),
      ville: item.ville ? String(item.ville).trim() : city.name,
      departement: item.departement ? String(item.departement).trim() : 'Wouri',
      arrondissement: item.arrondissement ? String(item.arrondissement).trim() : undefined,
      fullAddress: item.fullAddress ? String(item.fullAddress).trim() : `${item.name}, ${city.name}, Cameroun`,
      lat: Number(item.lat),
      lng: Number(item.lng),
      active: item.active !== undefined ? Boolean(item.active) : true,
      status: item.active === false ? 'inactif' : 'actif',
      zone: item.zone ? String(item.zone).trim() : 'commercial',
      zoneType: item.zoneType || 'commercial',
      createdAt: new Date().toISOString()
    };
    createdNeighborhoods.push(newNb);
  }

  neighborhoods.push(...createdNeighborhoods);
  saveNeighborhoodsDiskBackup();
  batchUpsertNeighborhoodsToSupabase(createdNeighborhoods).catch(() => {});

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

  const city = cities.find(c => String(c.id) === String(cityId) || c.uuid === cityId);
  if (!city) {
    return res.status(404).json({ error: 'Ville introuvable.' });
  }

  let updatedCount = 0;
  let createdCount = 0;
  let ignoredCount = 0;

  for (const item of items) {
    // Protection Douala 6ème
    const isDla6 = item.status === 'ignored_douala_6' ||
      /\b(douala\s*6|douala\s*6e|douala\s*6eme|douala\s*6ieme|douala\s*vi|manoka)\b/i.test(item.arrondissement || '') ||
      /\b(douala\s*6|douala\s*6e|douala\s*6eme|douala\s*6ieme|douala\s*vi|manoka)\b/i.test(item.fullAddress || '') ||
      /\b(douala\s*6|douala\s*6e|douala\s*6eme|douala\s*6ieme|douala\s*vi|manoka)\b/i.test(item.name || '');

    if (isDla6) {
      ignoredCount++;
      continue;
    }

    if (item.status === 'update' && item.targetId) {
      const existing = neighborhoods.find(n => String(n.id) === String(item.targetId) || n.uuid === String(item.targetId));
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
      }
    } else if (item.status === 'create') {
      const newNb: Neighborhood = {
        id: String(getNextSequence('neighborhoods')),
        uuid: `nb_${randomUUID()}`,
        cityId: city.uuid || String(city.id),
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
    }
  }

  saveNeighborhoodsDiskBackup();

  await recordHistory({
    action: 'reconcile_neighborhoods',
    eventType: 'neighborhoods',
    title: 'Rectification des coordonnées et quartiers via Excel',
    description: `${updatedCount} quartiers rectifiés, ${createdCount} nouveaux créés, ${ignoredCount} ignorés pour ${city.name}.`,
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
