import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseUrl = rawUrl.trim().replace(/\/$/, '');
const supabaseAnonKey = rawKey.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' &&
  !supabaseUrl.includes('placeholder')
);

export const handleAuthError = (error: any) => {
  if (!error) return false;
  
  const message = error.message || error.error_description || (typeof error === 'string' ? error : '');
  if (
    message.includes('Refresh Token Not Found') || 
    message.includes('invalid_grant') ||
    message.includes('Refresh token has expired') ||
    message.includes('JWT expired') ||
    message.includes('token is expired')
  ) {
    console.warn("Sessão inválida detectada, limpando dados locais:", message);
    try {
      localStorage.removeItem('atlas-financeiro-auth');
    } catch (e) {}
    supabase.auth.signOut().catch(() => {});
    return true;
  }
  return false;
};

// Global safe fetch wrapper that catches intermittent network failures
const safeFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (err: any) {
    if (err.message === 'Failed to fetch') {
      console.warn(`[Supabase Network Notice] Não foi possível conectar ao Supabase (${typeof input === 'string' ? input : 'endpoint'}).`);
    }
    throw err;
  }
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
    },
    global: {
      fetch: safeFetch
    }
  }
);
