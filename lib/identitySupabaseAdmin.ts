import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdmin: SupabaseClient | null = null;

export function identitySupabaseAdmin(): SupabaseClient {
  const identityUrl =
    process.env.NEXT_PUBLIC_IDENTITY_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.IDENTITY_SUPABASE_SERVICE_ROLE_KEY;

  if (!identityUrl) {
    throw new Error("Identity Supabase URL missing. Set NEXT_PUBLIC_IDENTITY_SUPABASE_URL.");
  }
  if (!serviceRoleKey) {
    throw new Error("Identity service role key missing. Set IDENTITY_SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!cachedAdmin) {
    cachedAdmin = createClient(identityUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return cachedAdmin;
}
