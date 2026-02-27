import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let storeAdmin: SupabaseClient<any> | null = null;

export type KnexAiSessionRow = {
  id: string;
  client_session_id: string;
};

export function getKnexAiStoreAdmin(): SupabaseClient<any> | null {
  if (!supabaseUrl || !serviceRoleKey) return null;
  if (storeAdmin) return storeAdmin;
  storeAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return storeAdmin;
}

export function normalizeSessionId(value: unknown): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return "";
  if (candidate.length < 8 || candidate.length > 128) return "";
  if (!/^[a-zA-Z0-9:_-]+$/.test(candidate)) return "";
  return candidate;
}

export function normalizeTitle(value: unknown): string {
  const candidate = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!candidate) return "Novo chat";
  return candidate.slice(0, 160);
}

export async function resolveKnexAiSession(
  admin: SupabaseClient<any>,
  clientSessionId: string,
  createIfMissing: boolean,
): Promise<KnexAiSessionRow | null> {
  const { data: found, error: lookupError } = await admin
    .from("knexai_sessions")
    .select("id, client_session_id")
    .eq("client_session_id", clientSessionId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (found) {
    await admin.from("knexai_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", found.id);
    return found as KnexAiSessionRow;
  }

  if (!createIfMissing) return null;

  const { data: created, error: createError } = await admin
    .from("knexai_sessions")
    .insert({ client_session_id: clientSessionId, last_seen_at: new Date().toISOString() })
    .select("id, client_session_id")
    .single();
  if (createError) throw createError;
  return created as KnexAiSessionRow;
}
