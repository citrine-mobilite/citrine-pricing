import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://npwauvoacscumdzpbjoc.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wd2F1dm9hY3NjdW1kenBiam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NjQ5NjYsImV4cCI6MjEwNzI0MDk2Nn0.R7ysIFdpjlkg64qMFbxdrsmpKuqMezg5XGVOFyhZMMg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

export default supabase;
