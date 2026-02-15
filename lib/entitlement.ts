import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";

type EntitlementDecision = {
  allowed: boolean;
  scope: "user" | "tenant" | null;
};

type CachedDecision = {
  decision: EntitlementDecision;
  expiresAt: number;
};

const CACHE_TTL_MS = 2 * 60 * 1000;

const cacheStore =
  (globalThis as { __entitlementCache?: Map<string, CachedDecision> }).__entitlementCache ??
  new Map<string, CachedDecision>();
(globalThis as { __entitlementCache?: Map<string, CachedDecision> }).__entitlementCache = cacheStore;

const ACTIVE_STATUSES = new Set(["active", "trial"]);

const isWithinWindow = (row: { starts_at?: string | null; ends_at?: string | null }) => {
  const now = Date.now();
  const startsOk = !row.starts_at || Date.parse(row.starts_at) <= now;
  const endsOk = !row.ends_at || Date.parse(row.ends_at) >= now;
  return startsOk && endsOk;
};

const cacheKey = (userId: string, appKey: string, tenantId?: string | null) =>
  `${userId}:${tenantId ?? "user"}:${appKey}`;

export async function getEntitlementDecision({
  userId,
  appKey,
  tenantId,
}: {
  userId: string;
  appKey: string;
  tenantId?: string | null;
}): Promise<EntitlementDecision> {
  const key = cacheKey(userId, appKey, tenantId);
  const cached = cacheStore.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.decision;
  }

  const admin = identitySupabaseAdmin();

  const { data: userRows, error: userError } = await admin
    .from("app_entitlements")
    .select("status, starts_at, ends_at, scope")
    .eq("app_key", appKey)
    .eq("user_id", userId);

  if (userError) {
    throw new Error(userError.message);
  }

  const userAllowed = (userRows ?? []).some((row) => {
    const status = String(row.status || "").toLowerCase();
    return ACTIVE_STATUSES.has(status) && isWithinWindow(row);
  });

  if (userAllowed) {
    const decision: EntitlementDecision = { allowed: true, scope: "user" };
    cacheStore.set(key, { decision, expiresAt: Date.now() + CACHE_TTL_MS });
    return decision;
  }

  if (tenantId) {
    const { data: tenantRows, error: tenantError } = await admin
      .from("app_entitlements")
      .select("status, starts_at, ends_at, scope")
      .eq("app_key", appKey)
      .eq("tenant_id", tenantId);

    if (tenantError) {
      throw new Error(tenantError.message);
    }

    const tenantAllowed = (tenantRows ?? []).some((row) => {
      const status = String(row.status || "").toLowerCase();
      return ACTIVE_STATUSES.has(status) && isWithinWindow(row);
    });

    if (tenantAllowed) {
      const decision: EntitlementDecision = { allowed: true, scope: "tenant" };
      cacheStore.set(key, { decision, expiresAt: Date.now() + CACHE_TTL_MS });
      return decision;
    }
  }

  const decision: EntitlementDecision = { allowed: false, scope: null };
  cacheStore.set(key, { decision, expiresAt: Date.now() + CACHE_TTL_MS });
  return decision;
}

export type { EntitlementDecision };
