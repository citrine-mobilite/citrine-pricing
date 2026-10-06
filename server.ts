import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import http from 'http';

import authRoutes from './server/routes/authRoutes.js';
import cityRoutes from './server/routes/cityRoutes.js';
import campaignRoutes from './server/routes/campaignRoutes.js';
import settingsRoutes from './server/routes/settingsRoutes.js';
import { syncFromFirestore } from './server/db/memoryStore.js';

dotenv.config();

// Filtrer les logs bruyants [vite] ou WebSocket au niveau du serveur Node.js
const origConsoleError = console.error;
console.error = (...args: any[]) => {
  const msg = args.map(a => String(a?.message || a || '')).join(' ');
  if (msg.includes('[vite]') || msg.includes('WebSocket') || msg.includes('websocket')) {
    return;
  }
  origConsoleError.apply(console, args);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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

// Synchronisation initiale Firestore en arrière-plan
syncFromFirestore().catch(e => console.warn('[Firestore] Sync warning:', e.message));

// Servir Vite en Développement ou dist en Production
async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const distIndex = path.resolve(distPath, 'index.html');
  const hasDist = fs.existsSync(distIndex);
  const isProd = process.env.NODE_ENV === 'production';

  const httpServer = http.createServer(app);

  if (isProd && hasDist) {
    console.log(`[VTC Pricing Hub] Mode Production: fichiers servis depuis ${distPath}`);
    app.use(express.static(distPath, {
      etag: false,
      lastModified: false,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: `Endpoint API non trouvé : ${req.method} ${req.path}` });
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(distIndex);
    });
  } else {
    console.log(`[VTC Pricing Hub] Mode Développement: middleware Vite actif`);
    app.all('/api/*', (req: Request, res: Response) => {
      return res.status(404).json({ error: `Endpoint API de développement non trouvé : ${req.method} ${req.path}` });
    });
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      logLevel: 'silent',
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[VTC Pricing Hub] Full-stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('[Global Express Error]', err);
  res.status(500).json({ error: err?.message || 'Erreur serveur' });
});

if (!process.env.VERCEL) {
  startServer();
}

export default app;
