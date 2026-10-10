import app from '../server/app.js';
import { ensureSynced } from '../server/db/memoryStore.js';

export default async function handler(req: any, res: any) {
  try {
    // Restaurer le chemin d'API d'origine si Vercel réécrit req.url en '/api'
    if (req.url === '/api' || req.url?.startsWith('/api?')) {
      const forwardedUri = req.headers['x-forwarded-uri'] || req.headers['x-matched-path'];
      if (forwardedUri && typeof forwardedUri === 'string' && forwardedUri.startsWith('/api')) {
        req.url = forwardedUri;
      }
    }

    await ensureSynced().catch(() => {});
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Serverless Function Error]', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: err?.message || 'Serverless Execution Error',
        stack: process.env.NODE_ENV === 'development' ? String(err?.stack || err) : undefined
      });
    }
  }
}