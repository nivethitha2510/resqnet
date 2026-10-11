/**
 * ResQNet Supabase Client Configuration
 * Official Supabase JS client integration.
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const gProcess = (typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined);
const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || gProcess?.env?.VITE_SUPABASE_URL || 'https://qnnuqmmpruqydxugsekw.supabase.co';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || gProcess?.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_uiGLrqJzZ2FZ0rHwnulNDQ_oqt6PDEq';

export const isSupabaseConfigured = (): boolean => {
  return (
    !!supabaseUrl &&
    !!supabaseAnonKey &&
    supabaseUrl !== 'https://your-supabase-project.supabase.co' &&
    supabaseAnonKey !== 'your-supabase-anon-key'
  );
};

export const missingEnvVariables = (): string[] => {
  const missing: string[] = [];
  if (!supabaseUrl || supabaseUrl === 'https://your-supabase-project.supabase.co') {
    missing.push('VITE_SUPABASE_URL');
  }
  if (!supabaseAnonKey || supabaseAnonKey === 'your-supabase-anon-key') {
    missing.push('VITE_SUPABASE_ANON_KEY');
  }
  return missing;
};

// Create Supabase client if configured, otherwise initialize with dummy URL to prevent startup crashes before UI handles error state
export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createClient('https://unconfigured-resqnet.supabase.co', 'unconfigured-anon-key');
