import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL');

export const handleAuthError = (error: any) => {
  if (!error) return false;
  
  const message = error.message || '';
  if (
    message.includes('Refresh Token Not Found') || 
    message.includes('invalid_grant') ||
    message.includes('Refresh token has expired')
  ) {
    console.warn("Sessão inválida detectada, limpando dados locais:", message);
    localStorage.removeItem('atlas-financeiro-auth');
    supabase.auth.signOut().catch(() => {});
    return true;
  }
  return false;
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'atlas-financeiro-auth',
      lock: (name: string, acquireTimeout: number, fn: () => Promise<any>) => fn()
    }
  }
);
