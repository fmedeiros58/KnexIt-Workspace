import { NextRequest } from "next/server";
import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";
import { findUserByEmail } from "@/lib/identityUserLookup";

export const runtime = "nodejs";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 100;

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
        { message: "Limite de tentativas atingido nesta etapa. Aguarde 15 minutos para tentar novamente." },
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
    const profileExists = Boolean(profileData && profileData.length > 0);

    const { user, error: userError } = await findUserByEmail(admin, email);
    if (userError) {
      return Response.json(
        {
          message:
            process.env.NODE_ENV === "development"
              ? userError.message
              : "Falha ao consultar o e-mail.",
        },
        { status: 500 },
      );
    }

    const providers = new Set<string>();
    if (user) {
      const identityProviders = user.identities?.map((identity) => identity.provider).filter(Boolean) ?? [];
      identityProviders.forEach((provider) => providers.add(provider));
      const appProviders = (user.app_metadata as { providers?: string[] } | null)?.providers ?? [];
      appProviders.forEach((provider) => providers.add(provider));
    }

    const exists = Boolean(user) || profileExists;
    const userMeta = (user?.user_metadata as { two_step_enabled?: boolean; twoStepEnabled?: boolean } | null) ?? null;
    const appMeta = (user?.app_metadata as { two_step_enabled?: boolean; twoStepEnabled?: boolean } | null) ?? null;
    const twoStepRequired = Boolean(
      userMeta?.two_step_enabled || userMeta?.twoStepEnabled || appMeta?.two_step_enabled || appMeta?.twoStepEnabled,
    );
    const providersKnown = providers.size > 0;
    const hasEmailProvider = providers.has("email");
    const hasPassword = exists ? (providersKnown ? hasEmailProvider : true) : false;
    const providersFlags = {
      google: providers.has("google"),
      facebook: providers.has("facebook"),
    };
    const methods = {
      otp: true,
      password: exists ? hasPassword : true,
      google: exists ? (providersKnown ? providersFlags.google : true) : true,
      facebook: exists ? (providersKnown ? providersFlags.facebook : true) : true,
    };

    const domain = email.split("@")[1] ?? "";
    console.info("[auth] lookup-email", { exists, providers: Array.from(providers), domain });

    return Response.json(
      { exists, hasPassword, providers: providersFlags, methods, twoStepRequired },
      { status: 200 },
    );
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
