type ExpressLikeApp = (req: any, res: any) => void;

let cachedAppPromise: Promise<ExpressLikeApp> | null = null;

function loadApp(): Promise<ExpressLikeApp> {
  if (!cachedAppPromise) {
    cachedAppPromise = import('../server.js')
      .then((mod: any) => (mod.default ?? mod) as ExpressLikeApp)
      .catch((err) => {
        // Permet de réessayer au prochain appel plutôt que de garder une promesse cassée en cache
        cachedAppPromise = null;
        throw err;
      });
  }
  return cachedAppPromise;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await loadApp();
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
