import { Router, Request, Response } from 'express';
import { yangoSettings, updateYangoSettings, getLastYangoRaw } from '../services/yangoService.js';
import { heroSettings, updateHeroSettings } from '../services/heroService.js';
import { tripMasterSettings, updateTripMasterSettings } from '../services/tripMasterService.js';

const router = Router();

// Yango Settings
router.get('/api/settings', (_req: Request, res: Response) => res.json(yangoSettings));
router.get('/api/settings/yango', (_req: Request, res: Response) => res.json(yangoSettings));

// Endpoint d'inspection du dernier JSON Yango brut
router.get('/api/yango/last-raw-json', (_req: Request, res: Response) => res.json(getLastYangoRaw()));
router.get('/api/settings/yango/last-raw-json', (_req: Request, res: Response) => res.json(getLastYangoRaw()));

router.post('/api/settings', async (req: Request, res: Response) => {
  updateYangoSettings(req.body);
  return res.json({ success: true, settings: yangoSettings });
});

router.post('/api/settings/yango', async (req: Request, res: Response) => {
  updateYangoSettings(req.body);
  return res.json({ success: true, settings: yangoSettings });
});

// Hero Settings
router.get('/api/settings/hero', (_req: Request, res: Response) => res.json(heroSettings));
router.post('/api/settings/hero', async (req: Request, res: Response) => {
  updateHeroSettings(req.body);
  return res.json({ success: true, settings: heroSettings });
});

// Trip Master Settings
router.get('/api/settings/tripmaster', (_req: Request, res: Response) => res.json(tripMasterSettings));
router.post('/api/settings/tripmaster', async (req: Request, res: Response) => {
  updateTripMasterSettings(req.body);
  return res.json({ success: true, settings: tripMasterSettings });
});

export default router;
