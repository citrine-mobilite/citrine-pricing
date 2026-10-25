import fs from 'fs';
import path from 'path';

const COUNTERS_FILE = path.resolve(process.cwd(), 'server/data/counters.json');

interface SystemCounters {
  campaigns: number;
  users: number;
  cities: number;
  neighborhoods: number;
  trips: number;
  history: number;
}

let cachedCounters: SystemCounters = {
  campaigns: 25,
  users: 4,
  cities: 2,
  neighborhoods: 267,
  trips: 20000,
  history: 10
};

function loadCounters(): SystemCounters {
  try {
    if (fs.existsSync(COUNTERS_FILE)) {
      const raw = fs.readFileSync(COUNTERS_FILE, 'utf8');
      const data = JSON.parse(raw);
      cachedCounters = {
        campaigns: Number(data.campaigns) || 25,
        users: Number(data.users) || 4,
        cities: Number(data.cities) || 2,
        neighborhoods: Number(data.neighborhoods) || 267,
        trips: Number(data.trips) || 20000,
        history: Number(data.history) || 10
      };
    }
  } catch (e: any) {
    console.warn('[Counters] Erreur de lecture de counters.json:', e.message);
  }
  return cachedCounters;
}

let persistTimer: NodeJS.Timeout | null = null;

function schedulePersistCounters() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistCounters();
  }, 1000);
}

function persistCounters() {
  try {
    const dir = path.dirname(COUNTERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(COUNTERS_FILE, JSON.stringify(cachedCounters, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[Counters] Erreur d’écriture de counters.json:', e.message);
  }
}

// Initialisation au démarrage
loadCounters();

export function getNextSequence(entity: keyof SystemCounters): number {
  if (entity === 'campaigns') {
    try {
      const campsFile = path.resolve(process.cwd(), 'server/data/campaigns.json');
      if (fs.existsSync(campsFile)) {
        const raw = fs.readFileSync(campsFile, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const maxId = list.reduce((max: number, c: any) => {
            const num = Number(c?.id);
            return Number.isFinite(num) ? Math.max(max, num) : max;
          }, 0);
          if (maxId >= (cachedCounters.campaigns || 0)) {
            cachedCounters.campaigns = maxId;
          }
        }
      }
    } catch {
      // safe fallback
    }
  }
  cachedCounters[entity] = (cachedCounters[entity] || 0) + 1;
  schedulePersistCounters();
  return cachedCounters[entity];
}

export function getCurrentCounters(): SystemCounters {
  return { ...cachedCounters };
}
