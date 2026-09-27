import app from '../server.js';

export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Serverless Function Error]', err);
    res.status(500).json({ error: err?.message || 'Serverless Execution Error' });
  }
}

