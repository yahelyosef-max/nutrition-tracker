/**
 * Supabase connection settings. Supabase's dashboard now calls the public key
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (older projects: ..._ANON_KEY); either works.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = () => SUPABASE_URL.startsWith("https://") && SUPABASE_KEY.length > 0;
