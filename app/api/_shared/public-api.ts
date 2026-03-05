import { randomUUID, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

import { logger } from "@/core/utils/logger";

type PublicApiOptions = {
  methods: readonly string[];
  requireApiKey?: boolean;
  rateLimitName?: string;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
};

type RateLimitState = {
  limit: number;
  remaining: number;
  resetAt: number;
  windowMs: number;
};

export type PublicApiContext = {
  requestId: string;
  path: string;
  method: string;
  origin: string;
  allowedOrigin: string | null;
  originAllowed: boolean;
  clientIp: string;
  forwardedProto: string;
  forwardedHost: string;
  publicBaseUrl: string;
  forwardedHeadersPresent: boolean;
  rateLimit: RateLimitState | null;
};

const ALLOW_HEADERS = "authorization, content-type, x-api-key";
const DEFAULT_PUBLIC_API_MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_PUBLIC_API_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_PUBLIC_API_RATE_LIMIT_MAX = 30;
const RATE_LIMIT_PRUNE_EVERY = 500;
const RATE_LIMIT_STORE =
  (globalThis as { __publicApiRateLimitStore?: Map<string, { count: number; resetAt: number }> })
    .__publicApiRateLimitStore ?? new Map<string, { count: number; resetAt: number }>();
(globalThis as { __publicApiRateLimitStore?: Map<string, { count: number; resetAt: number }> }).__publicApiRateLimitStore =
  RATE_LIMIT_STORE;
let rateLimitHitsCounter = 0;

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return "";
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return "";
  }
}

function pickFirstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const candidate = typeof value === "string" ? value.trim() : "";
    if (candidate) return candidate;
  }
  return "";
}

function loadAllowedOrigins(raw = process.env) {
  const configured = (raw.PUBLIC_API_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
  const fromEnv = [
    normalizeOrigin(raw.VERCEL_FRONTEND_ORIGIN),
    normalizeOrigin(raw.APP_PUBLIC_ORIGIN),
    normalizeOrigin(raw.NEXT_PUBLIC_APP_URL),
  ].filter(Boolean);

  const defaults =
    raw.NODE_ENV === "production"
      ? []
      : ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3004", "http://127.0.0.1:3004"];

  return Array.from(new Set([...configured, ...fromEnv, ...defaults]));
}

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return pickFirstNonEmpty(req.headers.get("x-real-ip")) || "unknown";
}

function getForwardedProto(req: NextRequest) {
  return pickFirstNonEmpty(req.headers.get("x-forwarded-proto"), req.nextUrl.protocol.replace(":", ""), "http");
}

function getForwardedHost(req: NextRequest) {
  return pickFirstNonEmpty(req.headers.get("x-forwarded-host"), req.headers.get("host"), req.nextUrl.host, "localhost");
}

function getPublicBaseUrl(req: NextRequest) {
  return `${getForwardedProto(req)}://${getForwardedHost(req)}`;
}

function extractApiKey(req: NextRequest) {
  const headerKey = pickFirstNonEmpty(req.headers.get("x-api-key"));
  if (headerKey) return headerKey;
  const authHeader = pickFirstNonEmpty(req.headers.get("authorization"));
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return "";
}

function loadApiKeys(raw = process.env) {
  const values = [raw.PUBLIC_API_KEYS, raw.PUBLIC_API_KEY]
    .flatMap((item) => (item || "").split(","))
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}

function parsePositiveInt(value: string | undefined, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function getPublicApiMaxBodyBytes(raw = process.env) {
  return parsePositiveInt(raw.PUBLIC_API_MAX_BODY_BYTES, DEFAULT_PUBLIC_API_MAX_BODY_BYTES, 1024, 5 * 1024 * 1024);
}

function getRateLimitConfig(options: PublicApiOptions, raw = process.env) {
  const enabledRaw = (raw.PUBLIC_API_RATE_LIMIT_ENABLED || "").trim().toLowerCase();
  const enabled = enabledRaw ? !["0", "false", "no", "off"].includes(enabledRaw) : true;
  const baseWindowMs = parsePositiveInt(raw.PUBLIC_API_RATE_LIMIT_WINDOW_MS, DEFAULT_PUBLIC_API_RATE_LIMIT_WINDOW_MS, 1_000, 3600_000);
  const baseMax = parsePositiveInt(raw.PUBLIC_API_RATE_LIMIT_MAX, DEFAULT_PUBLIC_API_RATE_LIMIT_MAX, 1, 10_000);

  const normalizedName = (options.rateLimitName || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
  const overrideWindow = normalizedName ? raw[`PUBLIC_API_RATE_LIMIT_WINDOW_MS_${normalizedName}`] : undefined;
  const overrideMax = normalizedName ? raw[`PUBLIC_API_RATE_LIMIT_MAX_${normalizedName}`] : undefined;
  const defaultWindow = options.rateLimitWindowMs ?? baseWindowMs;
  const defaultMax = options.rateLimitMax ?? baseMax;

  return {
    enabled,
    windowMs: parsePositiveInt(overrideWindow, defaultWindow, 1_000, 3600_000),
    max: parsePositiveInt(overrideMax, defaultMax, 1, 10_000),
    name: normalizedName || "DEFAULT",
  };
}

function shouldValidatePayloadLength(method: string) {
  return ["POST", "PUT", "PATCH"].includes(method.toUpperCase());
}

function parseContentLength(req: NextRequest) {
  const header = (req.headers.get("content-length") || "").trim();
  if (!header) return null;
  const value = Number(header);
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
}

function hitRateLimit(key: string, windowMs: number, max: number) {
  const now = Date.now();
  rateLimitHitsCounter += 1;
  if (rateLimitHitsCounter % RATE_LIMIT_PRUNE_EVERY === 0) {
    for (const [entryKey, entryValue] of RATE_LIMIT_STORE.entries()) {
      if (entryValue.resetAt <= now) {
        RATE_LIMIT_STORE.delete(entryKey);
      }
    }
  }

  const current = RATE_LIMIT_STORE.get(key);
  if (!current || current.resetAt <= now) {
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: max - 1, resetAt: now + windowMs };
  }
  if (current.count >= max) {
    return { limited: true, remaining: 0, resetAt: current.resetAt };
  }
  current.count += 1;
  RATE_LIMIT_STORE.set(key, current);
  return { limited: false, remaining: Math.max(0, max - current.count), resetAt: current.resetAt };
}

function looksLikeMissingProxyHeaders(req: NextRequest) {
  const hasForwardedProto = Boolean(pickFirstNonEmpty(req.headers.get("x-forwarded-proto")));
  const hasForwardedHost = Boolean(pickFirstNonEmpty(req.headers.get("x-forwarded-host")));
  return !(hasForwardedProto && hasForwardedHost);
}

function equalsConstantTime(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isApiKeyValid(candidate: string, acceptedKeys: string[]) {
  if (!candidate) return false;
  return acceptedKeys.some((expected) => equalsConstantTime(candidate, expected));
}

function buildCorsHeaders(context: PublicApiContext, methods: readonly string[]) {
  const headers = new Headers();
  headers.set("Vary", "Origin, X-Forwarded-For, X-Real-IP");
  headers.set("Access-Control-Allow-Methods", Array.from(new Set([...methods.map((m) => m.toUpperCase()), "OPTIONS"])).join(", "));
  headers.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("X-Request-Id", context.requestId);
  if (context.rateLimit) {
    headers.set("X-RateLimit-Limit", String(context.rateLimit.limit));
    headers.set("X-RateLimit-Remaining", String(context.rateLimit.remaining));
    headers.set("X-RateLimit-Reset", String(Math.max(0, Math.floor(context.rateLimit.resetAt / 1000))));
  }
  if (context.allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", context.allowedOrigin);
  }
  return headers;
}

export function buildResponseHeadersWithCors(
  context: PublicApiContext,
  options: Pick<PublicApiOptions, "methods">,
  extraHeaders: Record<string, string> = {},
) {
  const headers = buildCorsHeaders(context, options.methods);
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }
  return headers;
}

export function createPublicApiContext(req: NextRequest): PublicApiContext {
  const requestId = randomUUID();
  const origin = normalizeOrigin(req.headers.get("origin"));
  const allowedOrigins = loadAllowedOrigins();
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : null;

  return {
    requestId,
    path: req.nextUrl.pathname,
    method: req.method.toUpperCase(),
    origin,
    allowedOrigin,
    originAllowed: !origin || Boolean(allowedOrigin),
    clientIp: getClientIp(req),
    forwardedProto: getForwardedProto(req),
    forwardedHost: getForwardedHost(req),
    publicBaseUrl: getPublicBaseUrl(req),
    forwardedHeadersPresent: !looksLikeMissingProxyHeaders(req),
    rateLimit: null,
  };
}

export function jsonWithCors(
  context: PublicApiContext,
  body: unknown,
  status: number,
  options: Pick<PublicApiOptions, "methods">,
  extraHeaders: Record<string, string> = {},
) {
  const headers = buildResponseHeadersWithCors(context, options, extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

export function handlePublicApiPreflight(req: NextRequest, options: PublicApiOptions) {
  const context = createPublicApiContext(req);
  if (!context.originAllowed) {
    return jsonWithCors(
      context,
      {
        ok: false,
        code: "CORS_ORIGIN_FORBIDDEN",
        message: "Origin nao permitida para esta API.",
      },
      403,
      { methods: options.methods },
    );
  }

  return new Response(null, { status: 204, headers: buildCorsHeaders(context, options.methods) });
}

export function enforcePublicApiRequest(req: NextRequest, options: PublicApiOptions) {
  const context = createPublicApiContext(req);
  const contentLength = parseContentLength(req);
  const maxBodyBytes = getPublicApiMaxBodyBytes();

  if (process.env.NODE_ENV === "production" && !context.forwardedHeadersPresent) {
    logger.warn("PUBLIC_API_PROXY_HEADERS_MISSING", {
      requestId: context.requestId,
      path: context.path,
      method: context.method,
    });
  }

  if (shouldValidatePayloadLength(context.method) && contentLength !== null && contentLength > maxBodyBytes) {
    return {
      context,
      response: jsonWithCors(
        context,
        {
          ok: false,
          code: "PUBLIC_API_PAYLOAD_TOO_LARGE",
          message: `Payload excede limite permitido (${maxBodyBytes} bytes).`,
        },
        413,
        { methods: options.methods },
      ),
    };
  }

  if (!context.originAllowed) {
    return {
      context,
      response: jsonWithCors(
        context,
        {
          ok: false,
          code: "CORS_ORIGIN_FORBIDDEN",
          message: "Origin nao permitida para esta API.",
        },
        403,
        { methods: options.methods },
      ),
    };
  }

  const rateLimit = getRateLimitConfig(options);
  if (rateLimit.enabled) {
    const key = `${context.method}:${context.path}:${context.clientIp}`;
    const hit = hitRateLimit(key, rateLimit.windowMs, rateLimit.max);
    context.rateLimit = {
      limit: rateLimit.max,
      remaining: hit.remaining,
      resetAt: hit.resetAt,
      windowMs: rateLimit.windowMs,
    };
    if (hit.limited) {
      const retryAfterSeconds = Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000));
      logger.warn("PUBLIC_API_RATE_LIMIT_HIT", {
        requestId: context.requestId,
        path: context.path,
        method: context.method,
        clientIp: context.clientIp,
        rule: rateLimit.name,
        limit: rateLimit.max,
        windowMs: rateLimit.windowMs,
      });
      return {
        context,
        response: jsonWithCors(
          context,
          {
            ok: false,
            code: "PUBLIC_API_RATE_LIMITED",
            message: "Limite de requisicoes excedido para este endpoint.",
          },
          429,
          { methods: options.methods },
          { "Retry-After": String(retryAfterSeconds) },
        ),
      };
    }
  }

  if (options.requireApiKey) {
    const apiKeys = loadApiKeys();
    if (!apiKeys.length && process.env.NODE_ENV === "production") {
      return {
        context,
        response: jsonWithCors(
          context,
          {
            ok: false,
            code: "PUBLIC_API_KEY_NOT_CONFIGURED",
            message: "API publica indisponivel: configure PUBLIC_API_KEY(S).",
          },
          503,
          { methods: options.methods },
        ),
      };
    }

    if (apiKeys.length) {
      const candidate = extractApiKey(req);
      if (!isApiKeyValid(candidate, apiKeys)) {
        return {
          context,
          response: jsonWithCors(
            context,
            {
              ok: false,
              code: "PUBLIC_API_UNAUTHORIZED",
              message: "API key invalida para API publica.",
            },
            401,
            { methods: options.methods },
          ),
        };
      }
    }
  }

  return { context, response: null as Response | null };
}

export async function readJsonBodyWithLimit(
  req: NextRequest,
  context: PublicApiContext,
  options: { methods: readonly string[]; maxBytes?: number } = { methods: ["POST"] },
) {
  const maxBytes = options.maxBytes ?? getPublicApiMaxBodyBytes();
  const rawBody = await req.text().catch(() => "");
  const rawBytes = Buffer.byteLength(rawBody, "utf8");
  if (rawBytes > maxBytes) {
    return {
      body: null,
      response: jsonWithCors(
        context,
        {
          ok: false,
          code: "PUBLIC_API_PAYLOAD_TOO_LARGE",
          message: `Payload excede limite permitido (${maxBytes} bytes).`,
        },
        413,
        { methods: options.methods },
      ),
    };
  }

  if (!rawBody.trim()) {
    return { body: {}, response: null as Response | null };
  }

  try {
    const parsed = JSON.parse(rawBody);
    return { body: parsed, response: null as Response | null };
  } catch {
    return {
      body: null,
      response: jsonWithCors(
        context,
        {
          ok: false,
          code: "PUBLIC_API_INVALID_JSON",
          message: "Body JSON invalido.",
        },
        400,
        { methods: options.methods },
      ),
    };
  }
}

export function sanitizePublicErrorMessage(message: string, fallback: string) {
  if (process.env.NODE_ENV === "production") {
    return fallback;
  }
  return message || fallback;
}
