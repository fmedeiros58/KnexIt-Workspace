import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import crypto from "crypto";
import { Redis } from "@upstash/redis";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin: SupabaseClient<Database> | null = null;

type AuthCacheEntry = {
  email: string;
  exp?: number;
  cachedAt: number;
};

type TicketEntry = {
  email: string;
  exp: number;
};

type AuthCacheStore = Map<string, AuthCacheEntry>;
type TicketStore = Map<string, TicketEntry>;
type RedisClient = Redis;

const cacheStore =
  (globalThis as { __knexchatAuthCache?: AuthCacheStore }).__knexchatAuthCache ??
  new Map<string, AuthCacheEntry>();
(globalThis as { __knexchatAuthCache?: AuthCacheStore }).__knexchatAuthCache = cacheStore;

const ticketStore =
  (globalThis as { __knexchatRealtimeTicketStore?: TicketStore }).__knexchatRealtimeTicketStore ??
  new Map<string, TicketEntry>();
(globalThis as { __knexchatRealtimeTicketStore?: TicketStore }).__knexchatRealtimeTicketStore = ticketStore;

const CACHE_TTL_MS = 5 * 60 * 1000;
const TICKET_TTL_MS = 60 * 1000;
const TICKET_KEY_PREFIX = "knexchat:realtime-ticket:";
const ALLOW_JWT_FALLBACK =
  process.env.KNEXCHAT_ALLOW_JWT_FALLBACK === "1" || process.env.NODE_ENV !== "production";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const getCachedEmail = (token: string) => {
  const entry = cacheStore.get(token);
  if (!entry) return null;
  if (typeof entry.exp === "number") {
    if (entry.exp * 1000 <= Date.now()) {
      cacheStore.delete(token);
      return null;
    }
  } else if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cacheStore.delete(token);
    return null;
  }
  return entry.email;
};

const setCachedEmail = (token: string, email: string, exp?: number) => {
  cacheStore.set(token, { email, exp, cachedAt: Date.now() });
};

const getRedisClient = () => {
  const cached = (globalThis as { __knexchatRedisClient?: RedisClient | null }).__knexchatRedisClient;
  if (cached !== undefined) return cached;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  if (!url || !token) {
    (globalThis as { __knexchatRedisClient?: RedisClient | null }).__knexchatRedisClient = null;
    return null;
  }
  const client = new Redis({ url, token });
  (globalThis as { __knexchatRedisClient?: RedisClient | null }).__knexchatRedisClient = client;
  return client;
};

const cleanupExpiredTickets = () => {
  const now = Date.now();
  for (const [ticket, entry] of ticketStore.entries()) {
    if (entry.exp <= now) {
      ticketStore.delete(ticket);
    }
  }
};

export const issueRealtimeTicket = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const ttlSeconds = Math.max(1, Math.floor(TICKET_TTL_MS / 1000));
  const redis = getRedisClient();
  let ticket = "";

  if (redis) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      ticket = crypto.randomBytes(24).toString("base64url");
      const key = `${TICKET_KEY_PREFIX}${ticket}`;
      const result = await redis.set(key, normalizedEmail, { ex: ttlSeconds, nx: true });
      if (result === "OK") {
        return { ticket, expiresIn: ttlSeconds };
      }
    }
  }

  cleanupExpiredTickets();
  do {
    ticket = crypto.randomBytes(24).toString("base64url");
  } while (ticketStore.has(ticket));
  ticketStore.set(ticket, { email: normalizedEmail, exp: Date.now() + TICKET_TTL_MS });
  return { ticket, expiresIn: ttlSeconds };
};

export const consumeRealtimeTicket = async (ticket: string) => {
  if (!ticket) return null;
  const redis = getRedisClient();
  if (redis) {
    const key = `${TICKET_KEY_PREFIX}${ticket}`;
    const value = await redis.get<string>(key);
    if (!value) return null;
    await redis.del(key);
    return value;
  }
  const entry = ticketStore.get(ticket);
  if (!entry) return null;
  ticketStore.delete(ticket);
  if (entry.exp <= Date.now()) return null;
  return entry.email;
};

const decodeJwtPayload = (token: string) => {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload) as {
      email?: string;
      exp?: number;
      iss?: string;
      user_metadata?: { email?: string };
    };
  } catch {
    return null;
  }
};

const extractBearerToken = (req: NextRequest) => {
  const header = req.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
};

const validateDecodedPayload = (payload: {
  exp?: number;
  iss?: string;
  email?: string;
  user_metadata?: { email?: string };
}) => {
  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) return null;
  if (payload.iss && supabaseUrl) {
    const expected = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1`;
    if (payload.iss !== expected) return null;
  }
  const email = payload.email || payload.user_metadata?.email || "";
  return email ? normalizeEmail(email) : null;
};

export const getSupabaseAdmin = () => {
  if (!supabaseUrl || !serviceRoleKey) return null;
  if (!supabaseAdmin) {
    supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin;
};

export async function resolveAuthEmail(req: NextRequest, tokenOverride?: string) {
  const token = tokenOverride || extractBearerToken(req);
  if (!token) return null;

  const cached = getCachedEmail(token);
  if (cached) return cached;

  if (ALLOW_JWT_FALLBACK) {
    const decoded = decodeJwtPayload(token);
    if (decoded) {
      const decodedEmail = validateDecodedPayload(decoded);
      if (decodedEmail) {
        setCachedEmail(token, decodedEmail, decoded.exp);
        return decodedEmail;
      }
    }
  }

  const admin = getSupabaseAdmin();
  if (!admin) return null;
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error) return null;
    const email = data?.user?.email ? normalizeEmail(data.user.email) : "";
    if (!email) return null;
    setCachedEmail(token, email);
    return email;
  } catch {
    return null;
  }
}
