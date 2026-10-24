import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const CONFIG_FILE = path.resolve(DATA_DIR, 'supabase_config.json');

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  connected?: boolean;
}

let cachedConfig: SupabaseConfig = {
  url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
};

// Charger la config sauvegardée sur disque si présente
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.url && parsed.anonKey) {
      cachedConfig = { ...cachedConfig, ...parsed };
    }
  }
} catch (e: any) {
  console.warn('[Supabase] Warning reading config file:', e.message);
}

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  const url = cachedConfig.url;
  const key = cachedConfig.serviceRoleKey || cachedConfig.anonKey;
  if (!url || !key) return null;

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    return supabaseClient;
  } catch (err: any) {
    console.warn('[Supabase] Client init failed:', err.message);
    return null;
  }
}

export function saveSupabaseConfig(config: Partial<SupabaseConfig>): SupabaseConfig {
  cachedConfig = {
    ...cachedConfig,
    ...config
  };
  supabaseClient = null; // Re-create on next get

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cachedConfig, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[Supabase] Warning writing config file:', e.message);
  }

  return cachedConfig;
}

export function getSupabaseConfig(): SupabaseConfig {
  return { ...cachedConfig };
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'URL ou Clé API Supabase non configurée.' };
  }

  try {
    // Tentative de ping ou sélection légère
    const { error } = await client.from('cities').select('id').limit(1);
    if (error && error.code !== '42P01') { // 42P01 = table doesn't exist yet, but connection is OK
      return { success: false, message: `Erreur Supabase: ${error.message} (${error.code})` };
    }
    return { success: true, message: 'Connexion Supabase réussie avec succès !' };
  } catch (err: any) {
    return { success: false, message: `Connexion impossible: ${err.message}` };
  }
}
