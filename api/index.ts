import app from '../server.js';
import { ensureSynced } from '../server/db/memoryStore.js';

export default async function handler(req: any, res: any) {
  try {
    await ensureSynced().catch(() => {});
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Serverless Function Error]', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: err?.message || 'Serverless Execution Error',
        stack: String(err?.stack || err)
      });
    }
  }
}