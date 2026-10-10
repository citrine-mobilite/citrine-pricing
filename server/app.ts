import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import cityRoutes from './routes/cityRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { syncFromFirestore } from './db/memoryStore.js';

dotenv.config();

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

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Synchronisation initiale Firestore en arriÃ¨re-plan
syncFromFirestore().catch((e: any) => console.warn('[Firestore] Sync warning:', e.message));

export default app;
