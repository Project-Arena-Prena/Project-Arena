'use client';

import { createBrowserClient } from '@supabase/ssr';
import { supabaseConfig } from './config';

export function createClient() {
  if (!supabaseConfig) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return createBrowserClient(supabaseConfig.url, supabaseConfig.anonKey);
}
