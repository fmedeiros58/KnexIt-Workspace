import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";

type IdentityUser = {
  userId: string;
  email: string;
};

type CachedToken = {
  user: IdentityUser;
  exp?: number;
  cachedAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

const cacheStore =
  (globalThis as { __identityTokenCache?: Map<string, CachedToken> }).__identityTokenCache ??
  new Map<string, CachedToken>();
(globalThis as { __identityTokenCache?: Map<string, CachedToken> }).__identityTokenCache = cacheStore;

const getIdentityIssuer = () => {
  const base =
    process.env.NEXT_PUBLIC_IDENTITY_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  return base ? `${base.replace(/\/+$/, "")}/auth/v1` : "";
};

const decodeJwtPayload = (token: string) => {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload) as {
      sub?: string;
      email?: string;
      exp?: number;
      iss?: string;
      user_metadata?: { email?: string };
    };
  } catch {
    return null;
  }
};

const getCachedUser = (token: string) => {
  const entry = cacheStore.get(token);
  if (!entry) return null;
  if (typeof entry.exp === "number" && entry.exp * 1000 <= Date.now()) {
    cacheStore.delete(token);
    return null;
  }
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cacheStore.delete(token);
    return null;
  }
  return entry.user;
};

const setCachedUser = (token: string, user: IdentityUser, exp?: number) => {
  cacheStore.set(token, { user, exp, cachedAt: Date.now() });
};

export const extractBearerToken = (req: Request) => {
  const header = req.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
};

export async function resolveIdentityUser(token: string): Promise<IdentityUser | null> {
  if (!token) return null;
  const cached = getCachedUser(token);
  if (cached) return cached;

  const payload = decodeJwtPayload(token);
  const issuer = getIdentityIssuer();
  if (payload?.iss && issuer && payload.iss !== issuer) return null;
  if (typeof payload?.exp === "number" && payload.exp * 1000 <= Date.now()) return null;

  const admin = identitySupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) return null;

  const email = data.user.email || payload?.email || payload?.user_metadata?.email || "";
  if (!email) return null;

  const user = { userId: data.user.id, email: email.toLowerCase() };
  setCachedUser(token, user, payload?.exp);
  return user;
}

export type { IdentityUser };
