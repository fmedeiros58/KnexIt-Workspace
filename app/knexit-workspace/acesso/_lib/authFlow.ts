type ParamsLike = {
  get: (key: string) => string | null;
};

export type AccessStep = "email" | "metodo" | "senha" | "codigo";
export type OtpPurpose = "login" | "signup" | "recovery" | "oauth_verify";

const CONTEXT_KEYS = ["returnTo", "redirect", "from", "stay"] as const;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, "");

export const isEmail = (value: string) => EMAIL_REGEX.test(value);

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const getSignupPasswordKey = (email: string) => `knex_signup_password:${normalizeEmail(email)}`;

export const buildModeFromPurpose = (purpose: OtpPurpose) => {
  if (purpose === "signup") return "otp_signup";
  if (purpose === "recovery") return "otp_recovery";
  if (purpose === "oauth_verify") return "otp_oauth_verify";
  return "otp_login";
};

export const readContextParams = (source: ParamsLike) => {
  const params = new URLSearchParams();
  CONTEXT_KEYS.forEach((key) => {
    const value = source.get(key);
    if (value) params.set(key, value);
  });
  return params;
};

export const buildAccessStepHref = (
  step: AccessStep,
  source: ParamsLike,
  extra?: Record<string, string | null | undefined>,
) => {
  const params = readContextParams(source);
  if (extra) {
    Object.entries(extra).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      params.set(key, value);
    });
  }
  const query = params.toString();
  return `/knexit-workspace/acesso/${step}${query ? `?${query}` : ""}`;
};

export const getAppBaseUrl = () => {
  const envBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envBase) return normalizeBaseUrl(envBase);
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    return normalizeBaseUrl(window.location.origin);
  }
  return "https://knexspace.com";
};

export const resolveReturnTo = (source: ParamsLike, appBaseUrl: string) => {
  const fallback = "/knexit-workspace";
  const raw = source.get("returnTo") ?? source.get("redirect") ?? source.get("from");
  if (!raw) return fallback;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  try {
    const base = appBaseUrl || "https://knexspace.com";
    const url = new URL(decoded, base);
    const baseOrigin = new URL(base).origin;
    if (url.origin !== baseOrigin) return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return decoded.startsWith("/") ? decoded : fallback;
  }
};

export const resolvePostLoginTarget = async (returnTo: string, accessToken?: string | null) => {
  if (!returnTo.startsWith("/knexchat") || !accessToken) {
    return returnTo;
  }

  try {
    const res = await fetch("/api/knexchat/activation/status", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401) {
      // Do not force re-activation on transient/invalid-token probes.
      // Let KnexChat guard handle auth/activation checks in the product route.
      return returnTo;
    }
    const payload = (await res.json().catch(() => null)) as { activated?: boolean; profile_completed?: boolean } | null;
    if (res.ok && payload && payload.activated === false) {
      return `/knexchat/activate?returnTo=${encodeURIComponent(returnTo)}`;
    }
    if (res.ok && payload?.activated && payload.profile_completed === false) {
      return `/knexchat/activate/identity?returnTo=${encodeURIComponent(returnTo)}`;
    }
  } catch {
    // noop
  }

  return returnTo;
};
