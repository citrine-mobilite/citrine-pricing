import 'dotenv/config';
import express, { Request, Response } from 'express';

import authRoutes from './routes/authRoutes.js';
import cityRoutes from './routes/cityRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import statisticsRoutes from './routes/statisticsRoutes.js';
import shortageRoutes from './routes/shortageRoutes.js';
import { syncFromSupabase } from './db/memoryStore.js';
import { startCronScheduler } from './services/cronScheduler.js';

export const app = express();

// Middleware CORS et parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Enregistrement des sous-modules d'API
app.use(authRoutes);
app.use(cityRoutes);
app.use(campaignRoutes);
app.use(settingsRoutes);
app.use(statisticsRoutes);
app.use(shortageRoutes);

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Synchronisation au démarrage: la base Supabase devient la source de vérité si elle est disponible.
syncFromSupabase(true).catch((e: any) => console.warn('[Supabase] Startup sync warning:', e.message));

// Démarrer le planificateur de tâches cron (8h, 13h, 18h & 20h, 23h, 2h)
startCronScheduler();

export default app;
