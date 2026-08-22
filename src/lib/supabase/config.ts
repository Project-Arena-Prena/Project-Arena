const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfig = url && anonKey ? { url, anonKey } : null;

export const isSupabaseConfigured = supabaseConfig !== null;
export const supabaseSecretConfig = url && secretKey ? { url, secretKey } : null;
