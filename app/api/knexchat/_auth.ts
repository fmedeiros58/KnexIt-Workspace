import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import crypto from "crypto";
import { Redis } from "@upstash/redis";
import { extractBearerToken, resolveIdentityUser, type IdentityUser } from "@/lib/identityAuth";
import { getEntitlementDecision } from "@/lib/entitlement";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KNEXCHAT_APP_KEY = "knexchat";

let supabaseAdmin: SupabaseClient<Database> | null = null;

type TicketEntry = {
  email: string;
  exp: number;
};

type TicketStore = Map<string, TicketEntry>;
type RedisClient = Redis;

const ticketStore =
  (globalThis as { __knexchatRealtimeTicketStore?: TicketStore }).__knexchatRealtimeTicketStore ??
  new Map<string, TicketEntry>();
(globalThis as { __knexchatRealtimeTicketStore?: TicketStore }).__knexchatRealtimeTicketStore = ticketStore;

const TICKET_TTL_MS = 60 * 1000;
const TICKET_KEY_PREFIX = "knexchat:realtime-ticket:";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

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

export const getSupabaseAdmin = () => {
  if (!supabaseUrl || !serviceRoleKey) return null;
  if (!supabaseAdmin) {
    supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin;
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

export async function requireKnexchatEntitlement(
  req: NextRequest,
  tokenOverride?: string,
): Promise<{ user: IdentityUser | null; token: string | null; response: Response | null }> {
  const token = tokenOverride || extractBearerToken(req);
  if (!token) {
    return { user: null, token: null, response: Response.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  try {
    const user = await resolveIdentityUser(token);
    if (!user) {
      return { user: null, token: null, response: Response.json({ message: "Unauthorized" }, { status: 401 }) };
    }

    const decision = await getEntitlementDecision({ userId: user.userId, appKey: KNEXCHAT_APP_KEY });
    if (!decision.allowed) {
      return {
        user,
        token,
        response: Response.json({ code: "ENTITLEMENT_REQUIRED", appKey: KNEXCHAT_APP_KEY }, { status: 403 }),
      };
    }

    return { user, token, response: null };
  } catch (error) {
    return { user: null, token: null, response: Response.json({ message: "Auth unavailable" }, { status: 500 }) };
  }
}
