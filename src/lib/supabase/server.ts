import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig, supabaseSecretConfig } from './config';

type CookiesToSet = { name: string; value: string; options: CookieOptions }[];

export async function createClient() {
  if (!supabaseConfig) return null;
  const cookieStore = await cookies();

  return createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet: CookiesToSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component; middleware refreshes the session instead.
        }
      },
    },
  });
}

export async function getSessionUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Elevated client for validated Route Handlers only. Never import this from a client component. */
export function createAdminClient() {
  if (!supabaseSecretConfig) return null;
  return createSupabaseClient(supabaseSecretConfig.url, supabaseSecretConfig.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
