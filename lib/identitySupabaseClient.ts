import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

const getIdentityConfig = () => {
  const fallbackUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const fallbackAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const identityUrl = process.env.NEXT_PUBLIC_IDENTITY_SUPABASE_URL ?? fallbackUrl;
  const identityAnonKey = process.env.NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY ?? fallbackAnonKey;
  const missingConfig = !identityUrl || !identityAnonKey;
  const usingFallback =
    !process.env.NEXT_PUBLIC_IDENTITY_SUPABASE_URL || !process.env.NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY;

  return { identityUrl, identityAnonKey, missingConfig, usingFallback };
};

export function identitySupabase(): SupabaseClient {
  const { identityUrl, identityAnonKey, missingConfig, usingFallback } = getIdentityConfig();
  if (missingConfig) {
    return new Proxy({} as SupabaseClient, {
      get() {
        throw new Error(
          "Identity Supabase env vars are missing. Set NEXT_PUBLIC_IDENTITY_SUPABASE_URL and NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY.",
        );
      },
    });
  }
  if (!cachedClient) {
    cachedClient = createClient(identityUrl, identityAnonKey);
  }
  if (typeof window !== "undefined" && usingFallback && process.env.NODE_ENV !== "production") {
    console.warn(
      "Identity Supabase env vars missing; using default Supabase credentials. Set NEXT_PUBLIC_IDENTITY_SUPABASE_URL and NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY to isolate identity.",
    );
  }
  return cachedClient;
}

export function isIdentitySupabaseConfigured() {
  const { missingConfig, usingFallback } = getIdentityConfig();
  return !missingConfig && !usingFallback;
}
