const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

// A NEXT_PUBLIC_ var that Vercel cannot resolve at build time is inlined as a
// non-empty placeholder, which is truthy but blows up inside createClient and
// takes the whole build down. Treat anything that is not an http(s) URL as unset
// so the callers fall back to mock data instead.
function httpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
}

const url = httpUrl(rawUrl);

export const supabaseConfig = url && anonKey ? { url, anonKey } : null;

export const isSupabaseConfigured = supabaseConfig !== null;
export const supabaseSecretConfig = url && secretKey ? { url, secretKey } : null;
