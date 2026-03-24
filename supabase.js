const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  window.__supabaseInitError = 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY in config.js.';
} else if (!window.supabase?.createClient) {
  window.__supabaseInitError = 'Supabase client library failed to load.';
} else {
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
