import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_STORAGE_KEY = 'citrine_supabase_config';

export interface SupabaseSettings {
  url: string;
  anonKey: string;
}

export function getStoredSupabaseConfig(): SupabaseSettings {
  try {
    const raw = localStorage.getItem(SUPABASE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.url && parsed.anonKey) return parsed;
    }
  } catch {}

  return {
    url: (import.meta as any).env?.VITE_SUPABASE_URL || '',
    anonKey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''
  };
}

export function saveStoredSupabaseConfig(config: SupabaseSettings) {
  try {
    localStorage.setItem(SUPABASE_STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;
  const config = getStoredSupabaseConfig();
  if (!config.url || !config.anonKey) return null;

  try {
    supabaseInstance = createClient(config.url, config.anonKey);
    return supabaseInstance;
  } catch (err) {
    console.warn('[Supabase Frontend] Init error:', err);
    return null;
  }
}

export function resetSupabaseClient() {
  supabaseInstance = null;
}
