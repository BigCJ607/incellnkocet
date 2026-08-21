import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Checks if the Supabase environment variables are properly configured.
 */
export const isSupabaseConfigured = (): boolean => {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.trim().length > 0 &&
    supabaseUrl.startsWith('https://') &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.trim().length > 0 &&
    supabaseAnonKey !== 'your-anon-public-key'
  );
};

// Fallback dummy URL to prevent createClient from throwing an error during startup if env vars are unset
const defaultUrl = isSupabaseConfigured() ? supabaseUrl : 'https://placeholder.supabase.co';
const defaultKey = isSupabaseConfigured() ? supabaseAnonKey : 'placeholder-key';

export const supabase: SupabaseClient = createClient(defaultUrl, defaultKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
