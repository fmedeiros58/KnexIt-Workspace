import { NextRequest } from "next/server";
import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";

export const runtime = "nodejs";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 6;

type RateEntry = {
  count: number;
  resetAt: number;
};

const rateStore =
  (globalThis as { __lookupRateStore?: Map<string, RateEntry> }).__lookupRateStore ??
  new Map<string, RateEntry>();
(globalThis as { __lookupRateStore?: Map<string, RateEntry> }).__lookupRateStore = rateStore;

const getClientIp = (req: NextRequest) => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "";
  return req.headers.get("x-real-ip") || "";
};

const hitRateLimit = (key: string) => {
  const now = Date.now();
  const entry = rateStore.get(key);
  if (!entry || entry.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count += 1;
  rateStore.set(key, entry);
  return false;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!emailRegex.test(email)) {
      return Response.json({ message: "E-mail inválido." }, { status: 400 });
    }

    const ip = getClientIp(req);
    if (hitRateLimit(`ip:${ip || "unknown"}`) || hitRateLimit(`email:${email}`)) {
      return Response.json(
        { message: "Limite de tentativas atingido. Tente novamente em instantes." },
        { status: 429 },
      );
    }

    let admin;
    try {
      admin = identitySupabaseAdmin();
    } catch (err) {
      return Response.json({ message: "Identity service role not configured." }, { status: 500 });
    }

    const { data: profileData } = await admin.from("profiles").select("id").eq("email", email).limit(1);
    if (profileData && profileData.length > 0) {
      return Response.json({ exists: true }, { status: 200 });
    }

    const perPage = 200;
    let page = 1;
    const maxPages = 10;
    while (page && page <= maxPages) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        return Response.json(
          { message: process.env.NODE_ENV === "development" ? error.message : "Falha ao consultar o e-mail." },
          { status: 500 },
        );
      }
      const exists = Boolean(
        data?.users?.some((user) => (user.email || "").toLowerCase() === email),
      );
      if (exists) {
        return Response.json({ exists: true }, { status: 200 });
      }
      page = data?.nextPage ?? 0;
    }

    return Response.json({ exists: false }, { status: 200 });
  } catch (error) {
    console.error("lookup-email failed", error);
    return Response.json(
      {
        message:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : "Falha ao validar o e-mail.",
      },
      { status: 500 },
    );
  }
}
