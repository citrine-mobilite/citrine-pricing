import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  cities,
  neighborhoods,
  setCities,
  setNeighborhoods,
  recordHistory,
  ensureSynced,
  saveCitiesDiskBackup,
  saveNeighborhoodsDiskBackup
} from '../db/memoryStore.js';
import {
  upsertCityToSupabase,
  deleteCityFromSupabase,
  fetchCitiesFromSupabase,
  upsertNeighborhoodToSupabase,
  deleteNeighborhoodFromSupabase,
  fetchNeighborhoodsFromSupabase,
  clearCityNeighborhoodsInSupabase
} from '../db/supabase.js';
import { City, Neighborhood } from '../types.js';

const router = Router();

// Cities
router.get('/api/cities', async (req: Request, res: Response) => {
  await ensureSynced().catch(() => {});
  const forceRefresh = req.query.forceRefresh === 'true';

  if (cities.length === 0 || forceRefresh) {
    try {
      const supaCities = await fetchCitiesFromSupabase();
      if (supaCities && supaCities.length > 0) {
        setCities(supaCities);
      }
    } catch (e: any) {
      console.warn('[Supabase] get cities error:', e.message);
    }
  }

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
  saveCitiesDiskBackup();
  await upsertCityToSupabase(newCity).catch(() => {});

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
      neighborhoods.forEach(n => {
        if (n.cityId === id) {
          n.active = false;
          upsertNeighborhoodToSupabase(n).catch(() => {});
        }
      });
      saveNeighborhoodsDiskBackup();
    }
  }
  if (autoSchedule !== undefined) city.autoSchedule = autoSchedule;

  saveCitiesDiskBackup();
  await upsertCityToSupabase(city).catch(() => {});
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
  saveCitiesDiskBackup();
  saveNeighborhoodsDiskBackup();

  await deleteCityFromSupabase(id).catch(() => {});
  await clearCityNeighborhoodsInSupabase(id).catch(() => {});

  await recordHistory({
    action: 'delete_city',
    eventType: 'cities',
    title: `Ville supprimée: ${deleted.name}`,
    description: `Suppression de ${deleted.name} et de tous ses quartiers associés.`
  });

  return res.json({ success: true, message: 'Ville et quartiers associés supprimés.' });
});

// Neighborhoods
router.get('/api/neighborhoods', async (req: Request, res: Response) => {
  const { cityId, forceRefresh } = req.query;
  await ensureSynced().catch(() => {});

  if (neighborhoods.length === 0 || forceRefresh === 'true') {
    try {
      const supaNbs = await fetchNeighborhoodsFromSupabase();
      if (supaNbs && supaNbs.length > 0) {
        setNeighborhoods(supaNbs);
      }
    } catch (e: any) {
      console.warn('[Supabase] get neighborhoods error:', e.message);
    }
  }

  let list = neighborhoods;
  if (cityId) {
    list = list.filter(n => n.cityId === String(cityId));
  }

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
  await upsertNeighborhoodToSupabase(newNb).catch(() => {});

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
  await upsertNeighborhoodToSupabase(nb).catch(() => {});
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
  await deleteNeighborhoodFromSupabase(id).catch(() => {});
  return res.json({ success: true, message: 'Quartier supprimé avec succès.' });
});

router.delete('/api/neighborhoods/city/:cityId', async (req: Request, res: Response) => {
  const { cityId } = req.params;
  const remaining = neighborhoods.filter(n => n.cityId !== cityId);
  setNeighborhoods(remaining);
  saveNeighborhoodsDiskBackup();
  await clearCityNeighborhoodsInSupabase(cityId).catch(() => {});
  return res.json({ success: true, message: 'Tous les quartiers de la ville ont été supprimés.' });
});

export default router;
