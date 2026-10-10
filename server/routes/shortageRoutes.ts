import { Router, Request, Response } from 'express';
import {
  getAllShortages,
  computeShortagesAnalytics,
  deleteShortageRecord,
  seedHistoricalShortagesFromTrips,
  CampaignShortageRecord
} from '../db/shortageStore.js';

const router = Router();

// 1. Liste paginée et filtrée des trajets en pénurie + analytique
router.get('/api/shortages', (req: Request, res: Response) => {
  const { cityId, timeSlot, arrondissement, search, limit = 50, offset = 0 } = req.query;

  let all = getAllShortages();

  if (cityId && cityId !== 'all') {
    all = all.filter(s => String(s.cityId) === String(cityId));
  }

  if (timeSlot && timeSlot !== 'all') {
    all = all.filter(s => s.timeSlot === String(timeSlot));
  }

  if (arrondissement && arrondissement !== 'all') {
    all = all.filter(s => s.arrondissementOrigin === String(arrondissement) || s.arrondissementDest === String(arrondissement));
  }

  if (search && typeof search === 'string' && search.trim()) {
    const q = search.toLowerCase().trim();
    all = all.filter(s =>
      s.origin.toLowerCase().includes(q) ||
      s.destination.toLowerCase().includes(q) ||
      String(s.campaignId).toLowerCase().includes(q)
    );
  }

  const total = all.length;
  const numLimit = Math.min(500, Math.max(1, parseInt(String(limit), 10) || 50));
  const numOffset = Math.max(0, parseInt(String(offset), 10) || 0);

  const paginated = all.slice(numOffset, numOffset + numLimit);
  const analytics = computeShortagesAnalytics(cityId ? String(cityId) : undefined);

  return res.json({
    total,
    limit: numLimit,
    offset: numOffset,
    shortages: paginated,
    analytics
  });
});

// 2. Analytique globale de la pénurie
router.get('/api/shortages/analytics', (req: Request, res: Response) => {
  const { cityId } = req.query;
  const analytics = computeShortagesAnalytics(cityId ? String(cityId) : undefined);
  return res.json(analytics);
});

// 3. Export CSV des trajets en pénurie
router.get('/api/shortages/export', (req: Request, res: Response) => {
  const { cityId, timeSlot } = req.query;
  let all = getAllShortages();

  if (cityId && cityId !== 'all') {
    all = all.filter(s => String(s.cityId) === String(cityId));
  }
  if (timeSlot && timeSlot !== 'all') {
    all = all.filter(s => s.timeSlot === String(timeSlot));
  }

  const csvHeader = [
    'ID',
    'ID Campagne',
    'Ville',
    'Date & Heure',
    'Créneau',
    'Quartier Départ',
    'Quartier Arrivée',
    'Arrondissement Départ',
    'Arrondissement Arrivée',
    'Distance (km)',
    'Durée Estimée (min)',
    'Temps Attente (min)',
    'Classes Indisponibles',
    'Embouteillage (Jams)'
  ].join(';');

  const csvRows = all.map(s => [
    `"${s.id}"`,
    `"${s.campaignId}"`,
    `"${s.cityName}"`,
    `"${s.timestamp}"`,
    `"${s.timeSlot}"`,
    `"${s.origin.replace(/"/g, '""')}"`,
    `"${s.destination.replace(/"/g, '""')}"`,
    `"${s.arrondissementOrigin || ''}"`,
    `"${s.arrondissementDest || ''}"`,
    s.distanceKm,
    s.durationMinutes,
    s.waitingMinutes || 10,
    `"${(s.unavailableClasses || []).join(', ')}"`,
    s.jams ? 'OUI' : 'NON'
  ].join(';'));

  const csvContent = [csvHeader, ...csvRows].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="citrine_trajets_penurie_${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send('\uFEFF' + csvContent);
});

// 4. Supprimer un relevé de pénurie
router.delete('/api/shortages/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const success = deleteShortageRecord(id);
  if (!success) {
    return res.status(404).json({ error: 'Trajet en pénurie non trouvé.' });
  }
  return res.json({ success: true, message: 'Trajet supprimé.' });
});

// 5. Ré-extraire les pénuries depuis les campagnes existantes
router.post('/api/shortages/re-extract', (_req: Request, res: Response) => {
  const count = seedHistoricalShortagesFromTrips();
  return res.json({ success: true, extractedCount: count, total: getAllShortages().length });
});

export default router;
